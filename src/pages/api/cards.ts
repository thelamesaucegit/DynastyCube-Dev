// src/pages/api/cards.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { Client } from 'pg';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const client = new Client({
    user: $PGUSER,
    password: $PGPASSWORD,
    host: $PGHOST,
    port: $PGPORT,
    database: $PGDATABASE,
    ssl: { rejectUnauthorized: false }, // required for DigitalOcean
  });

  try {
    await client.connect();
    const result = await client.query('SELECT * FROM cards WHERE pool_id = $1', ['01']);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('DB query error:', error);
    res.status(500).json({ error: 'Database query failed' });
  } finally {
    await client.end();
  }
}
