export const homeBlueprint = [
  { label: 'apps/', level: 0, color: 'teal', dir: true },
  { label: 'web/', level: 1, color: 'teal' },
  { label: 'api/', level: 1, color: 'coral' },
  { label: 'packages/', level: 0, color: 'indigo', dir: true },
  { label: 'ui/', level: 1, color: 'indigo' },
  { label: 'types/', level: 1, color: 'amber' },
  { label: 'config-typescript/', level: 1, color: 'ghost' },
  { label: 'turbo.json', level: 0, color: 'ghost' },
  { label: 'pnpm-workspace.yaml', level: 0, color: 'ghost' },
  { label: 'package.json', level: 0, color: 'ghost' },
] as const;

export const pipelineStages = [
  { id: 'install', icon: '⎔', command: 'pnpm install' },
  { id: 'lint', icon: '◇', command: 'pnpm lint' },
  { id: 'build', icon: '⬡', command: 'pnpm build' },
  { id: 'check', icon: '△', command: 'pnpm typecheck' },
  { id: 'run', icon: '→', command: 'pnpm dev' },
] as const;

export const featureItems = [
  'workspaceProtocols',
  'sharedUiPackage',
  'typedApiSample',
  'parallelExecution',
  'reusableConfig',
  'starterReadyStructure',
] as const;

export const quickstartItems = [
  { id: 'cloneRepo', command: 'git clone <repo> && pnpm i' },
  { id: 'startDeveloping', command: 'pnpm dev' },
  { id: 'verifyGraph', command: 'pnpm build && pnpm typecheck' },
] as const;

export const homePackages = [
  {
    id: 'web',
    title: 'apps/web',
    tone: 'teal',
  },
  {
    id: 'api',
    title: 'apps/api',
    tone: 'coral',
  },
  {
    id: 'ui',
    title: 'packages/ui',
    tone: 'indigo',
  },
  {
    id: 'types',
    title: 'packages/types',
    tone: 'amber',
  },
] as const;
