import { DateInputComponent } from './date-input.component';

describe('Shared calendar control', () => {
  it('preserves date strings without UTC conversion', () => {
    const control = new DateInputComponent();
    const change = jasmine.createSpy('change');
    control.registerOnChange(change);
    control.writeValue('2026-10-25');
    expect(control.value?.getFullYear()).toBe(2026);
    expect(control.value?.getMonth()).toBe(9);
    expect(control.value?.getDate()).toBe(25);
    control.update(new Date(2026, 9, 25, 12));
    expect(change).toHaveBeenCalledWith('2026-10-25');
  });
  it('preserves local publication date and time around a DST change', () => {
    const control = new DateInputComponent();
    control.kind = 'datetime';
    const change = jasmine.createSpy('change');
    control.registerOnChange(change);
    control.writeValue('2026-10-25T02:30');
    expect(control.value?.getHours()).toBe(2);
    control.update(new Date(2026, 9, 25, 2, 30));
    expect(change).toHaveBeenCalledWith('2026-10-25T02:30');
  });
  it('retains HH:mm for event times and emits empty string on clearing', () => {
    const control = new DateInputComponent();
    control.kind = 'time';
    const change = jasmine.createSpy('change');
    control.registerOnChange(change);
    control.writeValue('19:05');
    expect(control.value?.getHours()).toBe(19);
    expect(control.value?.getMinutes()).toBe(5);
    control.update(new Date(2026, 9, 25, 20, 15));
    expect(change).toHaveBeenCalledWith('20:15');
    control.update(null);
    expect(change).toHaveBeenCalledWith('');
  });
});
