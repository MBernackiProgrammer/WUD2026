import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';

/** PrimeNG calendar with the existing ISO local string form contract. */
@Component({
  selector: 'app-date-input',
  imports: [FormsModule, DatePickerModule],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateInputComponent), multi: true },
  ],
  template: `
    <p-datepicker
      [inputId]="inputId"
      [ngModel]="value"
      (ngModelChange)="update($event)"
      (onBlur)="touch()"
      [disabled]="disabled"
      [timeOnly]="kind === 'time'"
      [showTime]="kind === 'datetime'"
      [showIcon]="true"
      [showClear]="true"
      [readonlyInput]="true"
      dateFormat="dd.mm.yy"
      hourFormat="24"
      appendTo="body"
      [style]="{ width: '100%' }"
    />
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
  `,
})
export class DateInputComponent implements ControlValueAccessor {
  @Input() inputId = '';
  @Input() kind: 'date' | 'time' | 'datetime' = 'date';
  value: Date | null = null;
  disabled = false;
  private change: (value: string) => void = () => {};
  touch: () => void = () => {};
  writeValue(raw: string | null): void {
    if (!raw) {
      this.value = null;
      return;
    }
    const date = new Date(
      this.kind === 'time' ? `2000-01-01T${raw}` : raw.length === 10 ? raw + 'T12:00' : raw,
    );
    this.value = Number.isNaN(date.getTime()) ? null : date;
  }
  update(date: Date | null): void {
    this.value = date;
    if (!date) {
      this.change('');
      return;
    }
    const pad = (value: number) => String(value).padStart(2, '0');
    const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    this.change(this.kind === 'time' ? time : this.kind === 'date' ? day : day + 'T' + time);
  }
  registerOnChange(fn: (value: string) => void): void {
    this.change = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.touch = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
  }
}
