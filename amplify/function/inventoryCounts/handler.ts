import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const COMPONENT_TABLE = process.env.COMPONENT_TABLE!;
const SUBCATEGORY_TABLE = process.env.SUBCATEGORY_TABLE!;

// In-memory cache — survives Lambda warm invocations. 5 min staleness is
// acceptable for a summary badge; the subcategory screen still reads live.
let cache: { at: number; data: unknown } | null = null;
const CACHE_TTL_MS = 5 * 60_000;

interface SubRow { id: string; categoryId: string }
interface CountRow { count: number; lowStock: number }

async function scanSubcategories(): Promise<SubRow[]> {
  const out: SubRow[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const page = await ddb.send(
      new ScanCommand({
        TableName: SUBCATEGORY_TABLE,
        ProjectionExpression: "id, categoryId",
        ExclusiveStartKey: lastKey,
      })
    );
    for (const s of page.Items ?? []) out.push(s as SubRow);
    lastKey = page.LastEvaluatedKey as typeof lastKey;
  } while (lastKey);
  return out;
}

async function scanComponentCounts(): Promise<Map<string, CountRow>> {
  // Only reads the 3 fields we need — keeps transfer & scan cost minimal.
  const counts = new Map<string, CountRow>();
  let lastKey: Record<string, unknown> | undefined;
  do {
    const page = await ddb.send(
      new ScanCommand({
        TableName: COMPONENT_TABLE,
        ProjectionExpression: "subcategoryId, currentStock, minimumStock",
        ExclusiveStartKey: lastKey,
      })
    );
    for (const c of page.Items ?? []) {
      const subId = c.subcategoryId as string;
      if (!subId) continue;
      const cur = counts.get(subId) ?? { count: 0, lowStock: 0 };
      cur.count += 1;
      if ((c.currentStock ?? 0) < (c.minimumStock ?? 0)) cur.lowStock += 1;
      counts.set(subId, cur);
    }
    lastKey = page.LastEvaluatedKey as typeof lastKey;
  } while (lastKey);
  return counts;
}

export const handler = async () => {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;

  const [subs, componentCounts] = await Promise.all([
    scanSubcategories(),
    scanComponentCounts(),
  ]);

  const subsByCategory = new Map<string, string[]>();
  for (const s of subs) {
    if (!subsByCategory.has(s.categoryId)) subsByCategory.set(s.categoryId, []);
    subsByCategory.get(s.categoryId)!.push(s.id);
  }

  let totalSubs = 0;
  let totalComponents = 0;
  let totalLowStock = 0;
  const categories = [...subsByCategory.entries()].map(([categoryId, subIds]) => {
    let cc = 0;
    let lc = 0;
    for (const subId of subIds) {
      const c = componentCounts.get(subId);
      if (c) {
        cc += c.count;
        lc += c.lowStock;
      }
    }
    totalSubs += subIds.length;
    totalComponents += cc;
    totalLowStock += lc;
    return {
      categoryId,
      subcategoryCount: subIds.length,
      componentCount: cc,
      lowStockCount: lc,
    };
  });

  const result = {
    categories,
    totals: {
      subcategoryCount: totalSubs,
      componentCount: totalComponents,
      lowStockCount: totalLowStock,
    },
    cachedAt: new Date().toISOString(),
  };
  cache = { at: Date.now(), data: result };
  return result;
};