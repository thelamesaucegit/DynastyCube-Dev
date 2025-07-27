// src/app/page.tsx
import React from 'react';
//import Image from 'next/image';
import Link from 'next/link';
import Layout from '@/components/Layout';

export default function Page() {
  return (
    <Layout>
      <div className="text-center text-gray-300">
        <div className="hero-section">
          <h3 className="text-2xl font-semibold">Teams</h3>
          <p className="hero-subtitle">Teams</p>
        </div>

        <p>
          Meet the Teams
          <br /><br />

          🌟 <Link href="/teams/shards" className="text-blue-400"><strong>Alara Shards</strong></Link> 🌟
          <br />
          <i>&quot;Why not both?&quot;</i>
          <br /><br />

          ⛩ <Link href="/teams/ninja" className="text-blue-400"><strong>Kamigawa Ninja</strong></Link> ⛩
          <br />
          <i>&quot;Omae wa mou shindeiru.&quot;</i>
          <br /><br />

          🧟 <Link href="/teams/creeps" className="text-blue-400"><strong>Innistrad Creeps</strong></Link> 🧟
          <br />
          <i>&quot;Graveyard, Gatekeep, Girlboss&quot;</i>
          <br /><br />

          🌞 <Link href="/teams/demigods" className="text-blue-400"><strong>Theros Demigods</strong></Link> 🌞
          <br />
          <i>&quot;The Fates will decide&quot;</i>
          <br /><br />

          🔗 <Link href="/teams/guildpact" className="text-blue-400"><strong>Ravnica Guildpact</strong></Link> 🔗
          <br />
          <i>&quot;A Championship is won and lost before ever entering the battlefield&quot;</i>
          <br /><br />

          👽 <Link href="/teams/changelings" className="text-blue-400"><strong>Lorwyn Changelings</strong></Link> 👽
          <br />
          <i>&quot;Expect the unexpected&quot;</i>
          <br /><br />

          💠 <Link href="/teams/hedrons" className="text-blue-400"><strong>Zendikar Hedrons</strong></Link> 💠
          <br />
          <i>&quot;Good Vibes, No Escape&quot;</i>
          <br /><br />

          🐲 <Link href="/teams/dragons" className="text-blue-400"><strong>Tarkir Dragons</strong></Link> 🐲
          <br />
          <i>&quot;No cost too great&quot;</i>
        </p>

        <div className="content-divider mt-8"></div>
      </div>
    </Layout>
  );
}
