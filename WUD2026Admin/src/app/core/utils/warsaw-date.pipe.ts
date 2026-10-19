import { Pipe, PipeTransform } from '@angular/core';
@Pipe({ name: 'warsawDate', standalone: true })
export class WarsawDatePipe implements PipeTransform {
  transform(value: string | null): string {
    return value
      ? new Intl.DateTimeFormat('pl-PL', {
          timeZone: 'Europe/Warsaw',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        }).format(new Date(value))
      : '';
  }
}
