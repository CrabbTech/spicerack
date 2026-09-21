// One controller, shared by every view.

import { createContext, useContext } from 'react';
import { AppApi } from './controller';

export const AppContext = createContext<AppApi | null>(null);

export function useApp(): AppApi {
  const app = useContext(AppContext);
  if (!app) throw new Error('useApp outside <AppContext.Provider>');
  return app;
}
