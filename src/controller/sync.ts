import {
    IObjectMap, ClientSyncActionPayload,
    SocketRequestPayload, PamlightSyncResponsePayload,
    WriteOperationTypes, SyncActionTypes
} from '../shared';
import { Subject} from 'rxjs';
import { cloneDeep, values, findIndex, keys } from 'lodash';
import { UtilitiesService } from '../services/util.service';

export class ClientSyncStore {
    // response ids mapping to data
    private syncData: IObjectMap<ClientSyncActionPayload> = {};
    private utilitiesService = new UtilitiesService();

    constructor() { }

    public getSync(responseId: string): ClientSyncActionPayload {
        return this.syncData[responseId];
    }

    public finalizeSubject(subjId: string, responseId: string, cb: (ids: string[]) => void): void {
        if (this.syncData[responseId] && this.syncData[responseId].subjects[subjId]) {
            this.syncData[responseId].subjects[subjId].unsubscribe();
            delete this.syncData[responseId].subjects[subjId];

            const delayMs = 50;
            this.utilitiesService.delay(delayMs).subscribe(() => {
                cb(keys(this.syncData[responseId].subjects));
            });
        }
    }

    public createSync<T>(
        action: SocketRequestPayload, routeId: string, subject: Subject<T>, syncId: string, type: SyncActionTypes
    ): ClientSyncActionPayload {
        if (this.syncData[action.responseId]) {
            throw Error('Internal error encountered');
        }

        this.syncData[action.responseId] = {
            action,
            routeId,
            syncType: type,
            subjects: {},
            currentValue: undefined,
            updateSync: (subj: Subject<T>, id: string) => {
                this.updateSync(subj, action.responseId, id);
            }
        };

        this.syncData[action.responseId].updateSync(subject, syncId);
        return this.getSync(action.responseId);
    }

    public onNewStream(data: PamlightSyncResponsePayload, responseId: string): void {
        const storeData = this.getSync(responseId);

        // subsequent changes
        if (data.opType) {
            const currentData = storeData.currentValue;

            // if current data is array, then we apply write operation types based on list
            // else, we apply based on single document
            if (Array.isArray(currentData)) {
                // apply operation type to list e.g, update a document in list or add to list if CREATE
                // if operation prop is specified, it means we should apply changes to current behaviourSubject
                // data before calling .next()

                const incomingData = data.result;
                switch (data.opType) {
                    case WriteOperationTypes.CREATE: {
                        data.result = currentData.concat([incomingData]);
                        break;
                    }

                    case WriteOperationTypes.UPDATE: {
                        // for now, we use _id to locate data in list
                        // how do we uniquely identify document if _id is not specified in returned list?
                        const previousDataIndex: number = findIndex(currentData, item => item._id === incomingData._id);

                        if (previousDataIndex >= 0) {
                            currentData[previousDataIndex] = incomingData;
                            data.result = currentData;
                        } else {
                            data.result = currentData.concat([incomingData]);
                        }

                        break;
                    }

                    case WriteOperationTypes.DELETE: {
                        // for now, we use _id to locate data in list
                        const previousDataIndex: number = findIndex(currentData, item => item._id === incomingData._id);

                        if (previousDataIndex >= 0) {
                            currentData.splice(previousDataIndex, 1);
                        }

                        data.result = currentData;
                        break;
                    }

                    default: {
                        throw Error('Operation not supported');
                    }
                }

                storeData.currentValue = data.result;
                this.updateObservers(storeData);
            } else if (storeData.currentValue && storeData.currentValue._id === data.result._id) {
                // delete operation type turns the document to null
                storeData.currentValue = data.opType === WriteOperationTypes.DELETE
                    ? null : data.result;
                this.updateObservers(storeData);
            }
        } else {
            storeData.currentValue = data.result;
            this.updateObservers(storeData);
        }
    }

    public getAllSyncs(): ClientSyncActionPayload[] {
        return values(this.syncData);
    }

    private updateObservers(storeData: ClientSyncActionPayload): void {
        values(storeData.subjects).forEach(subj => {
            subj.next(cloneDeep(storeData.currentValue));
        });
    }

    private updateSync<T>(subj: Subject<T>, responseId: string, subjId: string): void {
        this.syncData[responseId].subjects[subjId] = subj;
    }
}
