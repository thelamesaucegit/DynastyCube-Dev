// src/app/page.tsx
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Layout from '@/components/Layout';

export default function Page() {
  return (
    <Layout>
      <div className="hero-section">
        <h3>Teams</h3>
        <p className="hero-subtitle">Teams</p>
      </div>

      <p className="align-center">
        Meet the Teams
        <br /><br />

        🌟 <Link href="/teams/shards"><strong>Alara Shards</strong></Link> 🌟
        <br />
        <i>&quot;Why not both?&quot;</i>
        <br /><br />

        ⛩ <Link href="/teams/ninja"><strong>Kamigawa Ninja</strong></Link> ⛩
        <br />
        <i>&quot;Omae wa mou shindeiru.&quot;</i>
        <br /><br />

        🧟 <Link href="/teams/creeps"><strong>Innistrad Creeps</strong></Link> 🧟
        <br />
        <i>&quot;Graveyard, Gatekeep, Girlboss&quot;</i>
        <br /><br />

        🌞 <Link href="/teams/demigods"><strong>Theros Demigods</strong></Link> 🌞
        <br />
        <i>&quot;The Fates will decide&quot;</i>
        <br /><br />

        🔗 <Link href="/teams/guildpact"><strong>Ravnica Guildpact</strong></Link> 🔗
        <br />
        <i>&quot;A Championship is won and lost before ever entering the battlefield&quot;</i>
        <br /><br />

        👽 <Link href="/teams/changelings"><strong>Lorwyn Changelings</strong></Link> 👽
        <br />
        <i>&quot;Expect the unexpected&quot;</i>
        <br /><br />

        💠 <Link href="/teams/hedrons"><strong>Zendikar Hedrons</strong></Link> 💠
        <br />
        <i>&quot;Good Vibes, No Escape&quot;</i>
        <br /><br />

        🐲 <Link href="/teams/dragons"><strong>Tarkir Dragons</strong></Link> 🐲
        <br />
        <i>&quot;No cost too great&quot;</i>
      </p>

      <div className="content-divider"></div>
    </Layout>
  );
}
