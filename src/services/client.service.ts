import { sha1 } from 'object-hash';

export class PamlightClientService {
    constructor() { }

    public getResponseId(projectId: string, routeId: string, type: string, query?: any): string {
        let respId = `${projectId}_${routeId}_${type}_`;

        if (query) {
            respId += `${sha1(query)}`;
        }

        return respId;
    }

    public generateRandomId(): string {
        let d = new Date().getTime();
        if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
            d += performance.now(); // use high-precision timer if available
        }

        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            // tslint:disable-next-line: no-bitwise
            const r = (d + Math.random() * 16) % 16 | 0;
            d = Math.floor(d / 16);

            // tslint:disable-next-line: no-bitwise
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }
}
