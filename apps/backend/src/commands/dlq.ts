import { z, queueSchema, type Queue } from '@app/contracts';
import { createDatabase } from '@app/database';
import { connectBroker, redrive, WorkError } from '@app/messaging';
import type { GetMessage } from 'amqplib';

const [command = 'list', ...args] = process.argv.slice(2);
if (!['list', 'peek', 'retry'].includes(command)) throw new Error('Usage: npm run dlq -- list|peek|retry [--queue <queue>] [--limit 10]');
const flags = new Map<string, string>();
for (let index = 0; index < args.length; index += 2) {
  if (!['--queue', '--limit'].includes(args[index]) || !args[index + 1]) throw new Error('Invalid CLI arguments');
  flags.set(args[index], args[index + 1]);
}
const queue = flags.has('--queue') ? queueSchema.parse(flags.get('--queue')!.replace(/\.dlq$/, '')) : undefined;
const limit = z.coerce.number().int().min(1).max(100).parse(flags.get('--limit') ?? 10);
if (command === 'retry' && !queue) throw new Error('retry requires --queue');
const db = createDatabase();
let broker: Awaited<ReturnType<typeof connectBroker>> | undefined;
try {
  if (command === 'peek') {
    const rows = await db.deadLetter.findMany({ where: { ...(queue ? { queue } : {}), redrivenAt: null }, orderBy: { createdAt: 'asc' }, take: limit });
    console.log(JSON.stringify(rows, null, 2));
  } else {
    if (!process.env.RABBITMQ_URL) throw new Error('RABBITMQ_URL required');
    broker = await connectBroker(process.env.RABBITMQ_URL);
    if (command === 'list') {
      const names: Queue[] = queue ? [queue] : ['license.generate', 'notification.email', 'notification.metrics'];
      for (const name of names) {
        const actual = await broker.channel.checkQueue(`${name}.dlq`);
        const pending = await db.deadLetter.count({ where: { queue: name, redrivenAt: null } });
        console.log(JSON.stringify({ queue: `${name}.dlq`, brokerMessages: actual.messageCount, pendingRecords: pending }));
      }
    } else {
      const skipped: GetMessage[] = [];
      let replayed = 0;
      try {
        for (let index = 0; index < limit; index++) {
          const delivery = await broker.channel.get(`${queue}.dlq`, { noAck: false });
          if (!delivery) break;
          let id: string | undefined;
          try {
            id = z.object({ deadLetterId: z.uuid() }).strict().parse(JSON.parse(delivery.content.toString('utf8'))).deadLetterId;
            if (await redrive(db, id)) replayed++;
            broker.channel.ack(delivery);
          } catch (error) {
            skipped.push(delivery);
            console.error(JSON.stringify({ deadLetterId: id, code: error instanceof WorkError ? error.code : 'REPLAY_FAILED', retained: true }));
          }
        }
      } finally { for (const delivery of skipped) broker.channel.nack(delivery, false, true); }
      console.log(JSON.stringify({ replayed, retained: skipped.length }));
      if (skipped.length) process.exitCode = 1;
    }
  }
} finally {
  // Channel.Close is an ordered barrier for fire-and-forget ACK/NACK frames before Connection.Close.
  await broker?.channel.close().catch(() => {});
  await broker?.connection.close().catch(() => {});
  await db.$disconnect();
}
