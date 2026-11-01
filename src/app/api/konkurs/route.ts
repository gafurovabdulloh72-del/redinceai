import { handler, ok } from "@/lib/api";
import { listChallenges } from "@/lib/challenges/service";

/** GET — konkurslar ro'yxati (ommaviy): ochiq/kutilayotgan avval, keyin yakunlanganlar g'oliblari bilan */
export const GET = handler(async () => ok({ items: await listChallenges() }, { headers: { "cache-control": "public, max-age=60" } }));
