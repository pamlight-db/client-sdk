import {
    PamlightClientConfig, ClientSocket,
    SocketRequestPayload, IObjectMap,
    ClientSyncActionPayload, PamlightSyncResponsePayload,
    PamlightUtilities, SyncActionTypes,
    PamlightConstants, WriteOperationResponse
} from '../shared';
import { connect } from 'socket.io-client';
import { Observable, interval, Subject } from 'rxjs';
import { PamlightClientService } from '../services';
import { skipWhile, take, map, finalize } from 'rxjs/operators';
import { ClientSyncStore } from './sync';
import { cloneDeep, keys } from 'lodash';
import { SettingsConfig } from '../env-config';

export class PamlightClient {
    public utilities: PamlightUtilities;

    private _config: PamlightClientConfig;
    private _socket: ClientSocket;
    private _socketConnectionStatus: boolean;
    private clientService: PamlightClientService;
    private syncStore: ClientSyncStore;
    private checkedRoutes: IObjectMap<boolean> = {};
    private checkedWriteRoutes: IObjectMap<boolean> = {};
    private production: boolean;

    constructor(config: PamlightClientConfig) {
        this._config = config;
        this.production = true;
        this.clientService = new PamlightClientService();
        this.syncStore = new ClientSyncStore();
        this.utilities = this.createUtilitiesObject();
    }

    // for dev purpose
    public enableDevMode(): void {
        if (this._socket) {
            throw Error('Cannot enable dev mode after connection init');
        }

        this.production = false;
    }

    public connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            const domain = this.production ? SettingsConfig.socketServer : 'http://localhost:8002';

            this._socket = connect(domain);
            this.handleSocketBackgroundProcesses();

            this.handleConnectionInit().then(() => {
                resolve();
            }).catch(err => {
                reject(err);
            });
        });
    }

    private createUtilitiesObject(): PamlightUtilities {
        return {
            serverTime: (): Observable<Date> => {
                return this.handleRequestAction<Date>(
                    `${PamlightConstants.UTILITIES_SERVER_TIME}_RESULT`,
                    PamlightConstants.UTILITIES_SERVER_TIME,
                    SyncActionTypes.UTILITY
                ).pipe(
                    map(date => new Date(date))
                );
            }
        };
    }

    private handleConnectionInit(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._socket.once(PamlightConstants.CLIENT_SOCKET_VERIFICATION_SUCCESS, () => {
                this._socketConnectionStatus = true;
                resolve();
            });

            this._socket.once(PamlightConstants.CLIENT_SOCKET_VERIFICATION_ERROR, (err: any) => {
                this._socketConnectionStatus = false;
                reject(err);
            });

            this._socket.on(`${PamlightConstants.UTILITIES_VALIDATE_SYNC}_ERROR`, (err: any) => {
                const error = err && err.message ? err.message : err;
                throw Error(error);
            });

            this._socket.once(PamlightConstants.CLIENT_SOCKET_RECONNECTION_TRIGGER, async () => {
                this._socket.disconnect();

                await this.connect();
                const syncs: ClientSyncActionPayload[] = this.syncStore.getAllSyncs();
                syncs.forEach(sync => {
                    this.syncSocketAction(sync, false);
                });
            });

            // dispatch authentication/verification action
            this._socket.emit(PamlightConstants.CLIENT_VERIFY_SOCKET, this._config);
        });
    }

    private canSync(): Observable<boolean> {
        return interval(300).pipe(
            skipWhile(() => !this._socketConnectionStatus),
            take(1),
            map(() => true)
        );
    }

    private handleRequestAction<T>(responseId: string, routeId: string, type: SyncActionTypes, body?: IObjectMap<any>): Observable<T> {
        const subject: Subject<T> = new Subject();
        const subjectId: string = this.clientService.generateRandomId();

        body = body || {};

        // if socket is ready to sync
        this.canSync().subscribe(() => {
            const reqBody: SocketRequestPayload = { body, responseId };

            let storeData: ClientSyncActionPayload = this.syncStore.getSync(reqBody.responseId);
            if (storeData) {
                if (keys(storeData.subjects).length === 0) {
                    this.syncSocketAction(storeData, false);
                }

                storeData.updateSync(subject, subjectId);

                // there's update only if value is not undefined
                if (storeData.currentValue !== undefined) {
                    subject.next(cloneDeep(storeData.currentValue));
                }
            } else {
                storeData = this.syncStore.createSync(reqBody, routeId, subject, subjectId, type);
                this.syncSocketAction(storeData, false);
            }
        });

        return subject.asObservable().pipe(
            finalize(() => {
                this.syncStore.finalizeSubject(subjectId, responseId, (subjIds: string[]) => {
                    if (subjIds.length === 0) {
                        this._socket.off(`${responseId}_ERROR`);
                        this._socket.off(responseId);

                        // @TODO: notify server to clear sync data
                    }
                });
            })
        );
    }

    public sync<T>(routeId: string, body?: IObjectMap<any>): Observable<T> {
        const responseId = this.clientService.getResponseId(
            this._config.projectId, routeId, 'read', body
        );

        return this.handleRequestAction(responseId, routeId, SyncActionTypes.ROUTE, body);
    }

    public write<T>(routeId: string, payload: any, getDoc?: boolean): Promise<T> {
        return new Promise((resolve, reject) => {
            const responseId = this.clientService.getResponseId(
                this._config.projectId, routeId, this.clientService.generateRandomId(), payload
            );

            // listens for response
            this._socket.once(responseId, (response: WriteOperationResponse) => {
                if (response.err) {
                    reject(response.err);
                } else {
                    resolve(response.data);
                }
            });

            // listens for error response
            this._socket.once(`${responseId}_ERROR`, (err: any) => {
                reject(err);
            });

            // emits action
            this._socket.emit(
                `${this._config.projectId}_${routeId}_write`,
                {
                    body: payload,
                    getDoc,
                    responseId,
                    routeId
                }
            );

            if (!this.checkedWriteRoutes[routeId]) {
                this.checkedWriteRoutes[routeId] = true;

                this._socket.emit(`${this._config.projectId}_${PamlightConstants.UTILITIES_VALIDATE_WRITE}`, {
                    responseId,
                    routeId
                });
            }
        });
    }

    private syncSocketAction(storeData: ClientSyncActionPayload, refresh: boolean): void {
        if (!refresh) {
            // listens for error return
            this._socket.on(`${storeData.action.responseId}_ERROR`, (err: any) => {
                throw Error(err);
            });

            // listens for success callback
            this._socket.on(storeData.action.responseId, (result: PamlightSyncResponsePayload) => {
                this.syncStore.onNewStream(result, storeData.action.responseId);

                // updates server time subscription data
                const utilTimeResId = `${PamlightConstants.UTILITIES_SERVER_TIME}_RESULT`;
                const dateStoreData: ClientSyncActionPayload = this.syncStore.getSync(utilTimeResId);

                if (result.timestamp && dateStoreData) {
                    const date = new Date(result.timestamp);
                    this.syncStore.onNewStream(
                        { result: date, timestamp: date },
                        utilTimeResId
                    );
                }
            });
        }

        this._socket.emit(`${this._config.projectId}_${storeData.routeId}_read`, storeData.action);

        // verify validity of sync action when created
        this.validateSync(storeData);
    }

    private validateSync(data: ClientSyncActionPayload): void {
        if (!this.checkedRoutes[data.routeId]) {
            this.checkedRoutes[data.routeId] = true;

            this._socket.emit(`${this._config.projectId}_${PamlightConstants.UTILITIES_VALIDATE_SYNC}`, {
                syncType: data.syncType,
                routeId: data.routeId
            });
        }
    }

    private handleSocketBackgroundProcesses() {
        let disconnectionStatus: boolean;

        this._socket.on('connect', async () => {
            if (disconnectionStatus) {
                // this is a reconnection event
                disconnectionStatus = false;
                console.log('Reconnected to pamlight');

                // handle actions for reconnection
                this.handleConnectionInit().then(() => {
                    const syncs: ClientSyncActionPayload[] = this.syncStore.getAllSyncs();

                    syncs.forEach(sync => {
                        this.syncSocketAction(sync, true);
                    });
                }).catch(err => {
                    console.error(err);
                });
            }
        });

        this._socket.on('disconnect', () => {
            disconnectionStatus = true;

            // handle actions for disconnection
            console.log('Socket disconnected');
        });
    }
}
