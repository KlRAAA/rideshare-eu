// Point at one field with an error, the same way the browser's required check
// does (InvalidFieldHint): red box, a short flash, scrolled into view, and the
// message under it. For checks the browser can't do itself: custom pickers
// (DatePicker, TimePicker, Select), cross-field rules, and server errors that
// name a field.
export const FIELD_ERROR_EVENT = 'rsu:field-error';

export interface FieldErrorDetail {
  id: string;
  message: string;
}

export function flagField(id: string, message: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<FieldErrorDetail>(FIELD_ERROR_EVENT, { detail: { id, message } }));
}
