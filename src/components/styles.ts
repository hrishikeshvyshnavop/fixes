// Shared class strings (importable from server and client components).

export const button = {
  primary:
    "inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50",
  outline:
    "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-[13px] font-medium shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:hover:bg-input/50",
  ghost:
    "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  danger:
    "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
};

export const input =
  "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";
