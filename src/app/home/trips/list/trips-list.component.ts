import {Component, OnInit} from '@angular/core';
import {EMPTY_TRIP, TripInterface, TripsService} from '../trips.service';
import {CsvTools} from '../../common/csvtools.service';
import {saveAs} from 'file-saver';

@Component({
  selector: 'app-trips',
  templateUrl: './trips-list.component.html',
  styleUrls: ['./trips-list.component.scss']
})
export class TripsListComponent implements OnInit {
  searchValue = '';
  newTrip: TripInterface = EMPTY_TRIP;

  constructor(public trips: TripsService,
  ) {
  }

  ngOnInit() {
  }

  searchByName() {
    const value = this.searchValue ? this.searchValue.toLowerCase() : '';
    this.trips.init('trips', 'start', {
      reverse: true, prepend: false, searchValue: value,
    });
  }

  exportCsv() {
    this.trips.data.subscribe(res => {
      const tripsCsv = CsvTools.convertToCsv(res,
        ['start', 'end', 'country', 'state', 'city', 'purpose']);
      console.log(tripsCsv);
      const blob = new Blob([tripsCsv], {type: 'text/plain;charset=utf-8'});
      saveAs(blob, 'data.csv');
    });
  }

  calculateDaysPerYear(): Map<string, number> {
    const res = new Map<string, number>();
    this.trips.data.subscribe((trips) => {

    });
    return res;
  }
}
