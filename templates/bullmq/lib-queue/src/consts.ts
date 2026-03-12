const DEMO = 'demo-queue';

export type RegisterKey = 'DEMO';
export type RegisterQueueKey = {
  [key in RegisterKey]: string;
};

export const QUEUES: RegisterQueueKey = {
  DEMO,
};
