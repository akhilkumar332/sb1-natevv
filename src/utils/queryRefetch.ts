type Refetchable = {
  refetch: () => unknown;
};

export const refetchQuery = (query: Refetchable | null | undefined): void => {
  if (!query || typeof query.refetch !== 'function') return;
  void query.refetch();
};

export const refetchQueries = (...queries: Array<Refetchable | null | undefined>): void => {
  queries.forEach(refetchQuery);
};
