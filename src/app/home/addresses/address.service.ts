import {Injectable} from '@angular/core';
import {AngularFirestore, AngularFirestoreCollection} from '@angular/fire/firestore';
import {BehaviorSubject, Observable} from 'rxjs';
import 'rxjs/add/operator/do';
import 'rxjs/add/operator/scan';
import 'rxjs/add/operator/take';
// import * as firebase from 'firebase/app';
import {AngularFireAuth} from '@angular/fire/auth';
import {containsCaseInsensitive} from "../common/string.tools";
import {LocationInterface} from "../common/cities.service";

export const ADDRESS_HISTORY_PATH = 'address-history';

export interface QueryConfig {
  path: string; //  path to collection
  field: string; // field to orderBy
  limit: number; // limit per query
  reverse: boolean; // reverse order?
  prepend: boolean; // prepend to source?
  searchValue: string;
  filter: boolean;
}

export interface AddressInterface {
  editMode: boolean;
  id: number;
  start: Date;
  end: Date;
  locationName: string;
  city: string;
  state: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  address: string;
}

export const EMPTY_ADDRESS: AddressInterface = {
  editMode: false,
  id: null,
  start: null,
  end: null,
  locationName: '',
  city: null,
  state: null,
  country: null,
  countryCode: null,
  lat: null,
  lng: null,
  address: '',
};

@Injectable({
  providedIn: 'root'
})
export class AddressService {

  constructor(public db: AngularFirestore,
              public afAuth: AngularFireAuth) {
    const user = JSON.parse(localStorage.getItem('user'));
    this.userId = user.uid;
    this.init(ADDRESS_HISTORY_PATH, 'start', {reverse: true, prepend: false});
  }

  // Source data
  private _done = new BehaviorSubject(false);
  private _loading = new BehaviorSubject(false);
  private _data = new BehaviorSubject([]);

  private query: QueryConfig;

  // Observable data
  data: Observable<AddressInterface[]>;
  done: Observable<boolean> = this._done.asObservable();
  loading: Observable<boolean> = this._loading.asObservable();
  private readonly userId: string;

  // Initial query sets options and defines the Observable
  // passing opts will override the defaults
  init(path: string, field: string, opts?: any) {
    this.query = {
      path: path,
      field: field,
      limit: 50,
      reverse: false,
      prepend: true,
      searchValue: '',
      filter: true,
      ...opts
    };
    this.refresh();
  }

  // Retrieves additional data from firestore
  more() {
    const cursor = this.getCursor();
    const more = this.db.collection(this.query.path, ref => {
      return this.queryFn(ref).startAfter(cursor);
    });
    this.mapAndUpdate(more);
  }

  private queryFn(ref) {
    return ref
      .orderBy(this.query.field, this.query.reverse ? 'desc' : 'asc')
      .limit(this.query.limit);
  }

  // Determines the doc snapshot to paginate query
  private getCursor() {
    const current = this._data.value;
    if (current.length) {
      return this.query.prepend ? current[0].doc : current[current.length - 1].doc;
    }
    return null;
  }

  // Maps the snapshot to usable format the updates source
  private mapAndUpdate(col: AngularFirestoreCollection<any>) {
    if (this._done.value || this._loading.value) {
      return;
    }
    // loading
    this._loading.next(true);
    // Map snapshot with doc ref (needed for cursor)
    return col.snapshotChanges()
      .do(arr => {
        let values = arr.map(snap => {
          const data = snap.payload.doc.data();
          data.id = snap.payload.doc.id;
          const doc = snap.payload.doc;
          data.start = data.start ? data.start.toDate() : null;
          data.end = data.end ? data.end.toDate() : null;
          return {...data, doc};
        });

        // If prepending, reverse the batch order
        values = this.query.prepend ? values.reverse() : values;

        // update source with new values, done loading
        this._data.next(values);
        this._loading.next(false);

        // no more values, mark done
        if (!values.length) {
          this._done.next(true);
        }
      })
      .take(1)
      .subscribe();
  }


  get(key) {
    return this.userDoc().collection(this.query.path).doc(key).snapshotChanges();
  }

  update(key, value) {
    return this.userDoc().collection(this.query.path).doc(key).set(value);
  }

  delete(key) {
    return this.userDoc().collection(this.query.path).doc(key).delete();
  }

  create(value) {
    return this.userDoc().collection(this.query.path).add(value);
  }

  refresh() {
    const first = this.userDoc().collection(this.query.path, ref => {
      return this.queryFn(ref);
    });
    this.data = null;
    this._done.next(false);
    this._loading.next(false);
    this._data = new BehaviorSubject([]);
    this.mapAndUpdate(first);
    // Create the observable array for consumption in components
    this.data = this._data.asObservable().scan((acc, values) => {
      const val = values.filter((item: AddressInterface) => {
        return containsCaseInsensitive(item.locationName, this.query.searchValue)
          || containsCaseInsensitive(item.address, this.query.searchValue);
      });
      return this.query.prepend ? val.concat(acc) : acc.concat(val);
    });
  }

  private userDoc() {
    return this.db
      .collection('users')
      .doc(this.userId);
  }
}
