import { Subject, Observable } from 'rxjs';
import { SyncActionTypes, WriteOperationTypes } from '../enums';

export type ClientSocket = SocketIOClient.Socket;

export interface IObjectMap<T> {
    [key: string]: T;
}

export interface DocumentLog {
    createdAt: Date;
    updatedAt: Date;
    createdBy?: string;
    updatedBy?: string;
}

export interface PamlightClientConfig {
    projectId: string;
}

export interface ClientSyncActionPayload {
    action: SocketRequestPayload;
    routeId: string;
    syncType: SyncActionTypes;
    currentValue?: any;
    subjects: IObjectMap<Subject<any>>; // subject id maps to subject
    updateSync(subj: Subject<any>, subjId: string): void;
}

export interface PamlightUtilities {
    serverTime(): Observable<Date>;
}

export interface WriteOperationErrorResponse {
    error: string;
}

export interface WriteOperationResponse {
    err: WriteOperationErrorResponse;
    data: any;
}

export interface SocketRequestPayload {
    body?: any; // data sent from client
    responseId: string;
    routeId?: string;

    // for write operation
    getDoc?: boolean;
}

export interface SocketSyncItem {
    query: IObjectMap<any>;
    responseId: string;
}

export interface PamlightSyncResponsePayload {
    result: any;
    timestamp: Date;
    opType?: WriteOperationTypes; // specified opType is subsequent stream result
}

export interface PamlightApiError {
    message: string;
    code: number;
    date: Date;
}

export interface PamlightApiResponse {
    error?: PamlightApiError;
    timestamp: Date;
    data?: any;
}
