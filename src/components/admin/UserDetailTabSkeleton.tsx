function UserDetailTabSkeleton() {
  return (
    <section className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm animate-pulse">
      <div className="h-5 w-40 rounded bg-gray-200" />
      <div className="mt-4 space-y-3">
        <div className="h-4 w-full rounded bg-gray-100" />
        <div className="h-4 w-11/12 rounded bg-gray-100" />
        <div className="h-4 w-10/12 rounded bg-gray-100" />
      </div>
    </section>
  );
}

export default UserDetailTabSkeleton;
