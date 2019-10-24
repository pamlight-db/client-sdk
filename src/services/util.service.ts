import { Observable, of } from 'rxjs';
import { delay, take } from 'rxjs/operators';

export class UtilitiesService {
    public delay<T>(duration: number, value?: T): Observable<T> {
        return of(value).pipe(
            delay(duration),
            take(1)
        );
    }
}
