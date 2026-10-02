// src/state/store.ts
//
// Store + typed hooks, kept separate from redux.tsx's StoreProvider component
// so that file only exports a component (React Fast Refresh works reliably
// only when a file's exports are either all-components or all-non-components).
import { api } from "@/state/api";
import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector, type TypedUseSelectorHook } from "react-redux";

export const makeStore = () =>
  configureStore({
    reducer: { [api.reducerPath]: api.reducer },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(api.middleware),
  });

export const store = makeStore();

export type AppStore = typeof store;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
