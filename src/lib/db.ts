import Database from '@tauri-apps/plugin-sql';

const DB_URL = 'sqlite:equipment_manager.db';

export async function initDB() {
  const db = await Database.load(DB_URL);

  // 1. 기수 테이블 (cohorts)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS cohorts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT,
      sort_order INTEGER DEFAULT 0,
      is_hidden INTEGER DEFAULT 0
    );
  `);
  try { await db.execute("ALTER TABLE cohorts ADD COLUMN color TEXT"); } catch (e) { }
  try { await db.execute("ALTER TABLE cohorts ADD COLUMN sort_order INTEGER DEFAULT 0"); } catch (e) { }
  try { await db.execute("ALTER TABLE cohorts ADD COLUMN is_hidden INTEGER DEFAULT 0"); } catch (e) { }

  // 2. 장비 현황 (equipment)
  // status: IN_STOCK, NEEDS_INSPECTION, CHECKED_OUT, DAMAGED
  await db.execute(`
    CREATE TABLE IF NOT EXISTS equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      serial_number TEXT NOT NULL UNIQUE,
      status TEXT DEFAULT 'IN_STOCK'
    );
  `);

  // 3. 인원 (personnel)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS personnel (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cohort_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      duplicate_tag TEXT,
      FOREIGN KEY (cohort_id) REFERENCES cohorts(id)
    );
  `);

  // 4. 불출 이력 (checkouts)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS checkouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      personnel_id INTEGER NOT NULL,
      equipment_id INTEGER NOT NULL,
      checkout_date TEXT NOT NULL,
      return_date TEXT,
      remarks TEXT,
      previous_serial TEXT,
      FOREIGN KEY (personnel_id) REFERENCES personnel(id),
      FOREIGN KEY (equipment_id) REFERENCES equipment(id)
    );
  `);
  try { await db.execute("ALTER TABLE checkouts ADD COLUMN previous_serial TEXT"); } catch (e) { }

  // 5. 손상 보고 (damage_reports)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS damage_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER NOT NULL,
      report_date TEXT NOT NULL,
      description TEXT,
      image_path TEXT,
      FOREIGN KEY (equipment_id) REFERENCES equipment(id)
    );
  `);

  // 6. 장비 종류별 색상 매핑 (equipment_colors)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS equipment_colors (
      type TEXT PRIMARY KEY,
      color TEXT NOT NULL
    );
  `);

  return db;
}

export async function getDB() {
  return await Database.load(DB_URL);
}
