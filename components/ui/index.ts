/**
 * @file index.ts
 * @description Barrel for the "Clinical Trust" UI kit. Import primitives from
 * one place: `import { Button, Card, Input, Modal } from '../ui'`.
 */
export { cn } from './cn';
export { Button } from './Button';
export { Card } from './Card';
export { Input } from './Input';
export { Badge } from './Badge';
export { Modal } from './Modal';
export { Dropdown } from './Dropdown';
export type { DropdownItem } from './Dropdown';
export { Spinner, Skeleton, SkeletonCard, LoadingScreen, EmptyState } from './Loaders';
export { FeedbackProvider, useToast, useConfirm } from './Feedback';
