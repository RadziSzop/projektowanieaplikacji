import type { OrderJob } from '../types';

export type Progress = ReturnType<typeof orderProgress>;

export function orderProgress(jobs: OrderJob[]) {
  const emails = jobs.flatMap((job) => job.deliveries.filter((d) => d.kind === 'EMAIL'));
  return {
    total: jobs.length,
    generated: jobs.filter((job) => job.status === 'COMPLETED').length,
    failed: jobs.filter((job) => job.status === 'FAILED').length,
    emailsSent: emails.filter((d) => d.status === 'SENT').length,
    pending: jobs.some(
      (job) =>
        job.status === 'PENDING' ||
        job.status === 'PROCESSING' ||
        job.deliveries.some(
          (d) => d.kind === 'EMAIL' && (d.status === 'PENDING' || d.status === 'PROCESSING'),
        ),
    ),
  };
}
