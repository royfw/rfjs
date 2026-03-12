import { Queue } from 'bullmq';
import { demoQueue } from './demo';

export * from './demo';
export * from './redis';
export * from './consts';

export const queues: Queue[] = [demoQueue];
