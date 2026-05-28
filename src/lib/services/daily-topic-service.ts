/**
 * Daily featured topic — stored as three app_settings rows. Mirrors
 * [app/services/daily_topic_service.py].
 */
import { prisma } from "@/lib/db";

const KEY_TOPIC = "daily_topic";
const KEY_CATEGORY = "daily_topic_category";
const KEY_SET_AT = "daily_topic_set_at";

async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export interface DailyTopic {
  topic: string;
  category: string;
  set_at: string | null;
}

export async function getDaily(): Promise<DailyTopic | null> {
  const topic = await getSetting(KEY_TOPIC);
  if (!topic) return null;
  return {
    topic,
    category: (await getSetting(KEY_CATEGORY)) ?? "Society",
    set_at: await getSetting(KEY_SET_AT),
  };
}

export async function setDaily(
  topic: string,
  category = "Society",
): Promise<DailyTopic | null> {
  await setSetting(KEY_TOPIC, topic.trim());
  await setSetting(KEY_CATEGORY, (category ?? "Society").trim());
  await setSetting(KEY_SET_AT, new Date().toISOString());
  return getDaily();
}

export async function clearDaily(): Promise<void> {
  await setSetting(KEY_TOPIC, "");
  await setSetting(KEY_CATEGORY, "");
  await setSetting(KEY_SET_AT, "");
}
