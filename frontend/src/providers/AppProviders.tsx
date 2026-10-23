import { useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { QUERY_CACHE } from "@/lib/queryClient";

/**
 * Wires TanStack Query into the app and persists its cache to AsyncStorage so
 * server data (inbox, team) can be read offline. The "last updated" time shown
 * in the UI comes from each query's `dataUpdatedAt`, not from a second store.
 *
 * Cache policy (see STATE.md): server data lives in TanStack Query; nothing is
 * duplicated in client state.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Server state is the source of truth; treat it as stale after a
            // short window so the UI refreshes on focus without refetch storms.
            staleTime: QUERY_CACHE.staleTime,
            gcTime: QUERY_CACHE.gcTime,
            retry: 2,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  const [persister] = useState(() =>
    createAsyncStoragePersister({
      storage: AsyncStorage,
      key: "rota-query-cache",
    }),
  );

  // Settings live on the server. When the app returns to the foreground (a
  // different device may have changed them), refetch so every mounted screen
  // sees the same values. [Requirement 7]
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void queryClient.invalidateQueries();
      }
    });
    return () => subscription.remove();
  }, [queryClient]);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        // Cached data older than this is discarded on restore, so the app never
        // shows very old server data as if it were current.
        maxAge: QUERY_CACHE.persistMaxAge,
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
