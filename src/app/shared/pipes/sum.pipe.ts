import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'sum',
  standalone: true
})
export class SumPipe implements PipeTransform {

  transform(items: any[], attr: string): number {
    if (!items || !items.length) {
      return 0;
    }
    
    return items.reduce((sum, current) => {
      const value = current[attr];
      return sum + (isNaN(value) ? 0 : Number(value));
    }, 0);
  }
}
