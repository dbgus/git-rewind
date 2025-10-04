interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

export const Skeleton = ({ className = '', width, height, rounded = 'md' }: SkeletonProps) => {
  const roundedClass = {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  }[rounded];

  const style = {
    width,
    height,
  };

  return (
    <div
      className={`animate-shimmer ${roundedClass} ${className}`}
      style={style}
    />
  );
};

export const CommitCardSkeleton = () => {
  return (
    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
        <Skeleton width="120px" height="24px" />
        <Skeleton width="150px" height="20px" />
      </div>
      <div className="mb-3">
        <Skeleton width="100%" height="20px" className="mb-2" />
        <Skeleton width="80%" height="20px" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton width="100px" height="16px" />
        <Skeleton width="120px" height="16px" />
        <Skeleton width="150px" height="16px" />
      </div>
    </div>
  );
};

export const StatCardSkeleton = () => {
  return (
    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
      <Skeleton width="80px" height="16px" className="mb-2" />
      <Skeleton width="60px" height="32px" />
    </div>
  );
};

export const ChartCardSkeleton = () => {
  return (
    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
      <Skeleton width="150px" height="24px" className="mb-4" />
      <Skeleton width="100%" height="300px" />
    </div>
  );
};

export const FilterSkeleton = () => {
  return (
    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
      <Skeleton width="120px" height="24px" className="mb-4" />
      <div className="space-y-3">
        <Skeleton width="100%" height="40px" />
        <Skeleton width="100%" height="40px" />
        <Skeleton width="100%" height="40px" />
        <Skeleton width="100%" height="40px" />
        <Skeleton width="100%" height="40px" />
      </div>
    </div>
  );
};

export const SidebarListSkeleton = () => {
  return (
    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
      <Skeleton width="100px" height="24px" className="mb-3" />
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <Skeleton width="120px" height="20px" />
            <Skeleton width="30px" height="20px" />
          </div>
        ))}
      </div>
    </div>
  );
};
