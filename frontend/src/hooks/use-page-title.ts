import { useEffect } from 'react';

const APP_NAME = 'ACME Salary Management';

/** Sets the browser tab title, so screen-reader users and tab lists know the page. */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`;
  }, [title]);
}
