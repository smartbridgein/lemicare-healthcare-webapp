import { Injectable, ComponentRef, ApplicationRef, createComponent, EnvironmentInjector, inject } from '@angular/core';
import { ConfirmationModalComponent } from './confirmation-modal/confirmation-modal';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ModalService {
  private modalComponentRef: ComponentRef<ConfirmationModalComponent> | null = null;
  private backdropElement: HTMLElement | null = null;
  
  constructor(
    private appRef: ApplicationRef,
    private injector: EnvironmentInjector
  ) {}

  /**
   * Open a confirmation dialog
   * @param options Configuration options for the confirmation dialog
   * @returns Promise that resolves to true if confirmed, or false if cancelled
   */
  confirm(options: {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmButtonClass?: string;
    headerClass?: string;
  }): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      // Create subject for handling dialog result
      const result$ = new Subject<boolean>();
      result$.subscribe(result => {
        resolve(result);
        this.destroyModal();
      });

      // Create backdrop element
      this.backdropElement = document.createElement('div');
      this.backdropElement.className = 'modal-backdrop fade show';
      document.body.appendChild(this.backdropElement);
      
      // Add modal-open class to body
      document.body.classList.add('modal-open');

      // Create the component
      this.modalComponentRef = createComponent(ConfirmationModalComponent, {
        environmentInjector: this.injector,
      });

      // Set component properties
      const instance = this.modalComponentRef.instance;
      if (options.title) instance.title = options.title;
      if (options.message) instance.message = options.message;
      if (options.confirmText) instance.confirmText = options.confirmText;
      if (options.cancelText) instance.cancelText = options.cancelText;
      if (options.confirmButtonClass) instance.confirmButtonClass = options.confirmButtonClass;
      if (options.headerClass) instance.headerClass = options.headerClass;

      // Setup event handlers
      instance.confirmed.subscribe(() => {
        result$.next(true);
      });
      
      instance.cancelled.subscribe(() => {
        result$.next(false);
      });

      // Attach to the DOM
      document.body.appendChild(this.modalComponentRef.location.nativeElement);
      
      // Attach to Angular's change detection
      this.appRef.attachView(this.modalComponentRef.hostView);
      
      // Show the modal
      setTimeout(() => {
        const modalElement = this.modalComponentRef?.location.nativeElement.querySelector('.modal');
        if (modalElement) {
          modalElement.classList.add('show');
          modalElement.style.display = 'block';
        }
      }, 50);
    });
  }

  private destroyModal(): void {
    if (this.modalComponentRef) {
      // Hide the modal first
      const modalElement = this.modalComponentRef.location.nativeElement.querySelector('.modal');
      if (modalElement) {
        modalElement.classList.remove('show');
        modalElement.style.display = 'none';
      }
      
      // Remove from DOM
      const element = this.modalComponentRef.location.nativeElement;
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
      
      // Remove backdrop
      if (this.backdropElement && this.backdropElement.parentNode) {
        this.backdropElement.parentNode.removeChild(this.backdropElement);
        this.backdropElement = null;
      }
      
      // Remove modal-open class from body
      document.body.classList.remove('modal-open');
      
      // Detach from change detection and destroy
      this.appRef.detachView(this.modalComponentRef.hostView);
      this.modalComponentRef.destroy();
      this.modalComponentRef = null;
    }
  }
}
