type WithId = { id?: string };

type NotifyNewestOptions<T extends WithId> = {
  previous: T[];
  current: T[];
  onNew?: ((item: T) => void) | undefined;
};

export const notifyNewestItem = <T extends WithId>({
  previous,
  current,
  onNew,
}: NotifyNewestOptions<T>) => {
  if (!onNew) return;
  if (previous.length === 0 || current.length === 0) return;
  const newest = current[0];
  if (!newest?.id) return;
  const existed = previous.some((item) => item.id === newest.id);
  if (!existed) {
    onNew(newest);
  }
};
