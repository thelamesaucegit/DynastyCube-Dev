// src/app/teams/page.tsx
import React from 'react';
import Image from 'next/image';
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
        🌟 <strong>Alara Shards</strong> 🌟
        <br />
        <i>"Why not both?"</i>
        <br /><br />

        ⛩ <strong>Kamigawa Ninja</strong> ⛩
        <br />
        <i>"Omae wa mou shindeiru."</i>
        <br /><br />

        🧟 <strong>Innistrad Creeps</strong> 🧟
        <br />
        <i>"Graveyard, Gatekeep, Girlboss"</i>
        <br /><br />

        🌞 <strong>Theros Demigods</strong> 🌞
        <br />
        <i>"The Fates will decide"</i>
        <br /><br />

        🔗 <strong>Ravnica Guildpact</strong> 🔗
        <br />
        <i>"A Championship is won and lost before ever entering the battlefield"</i>
        <br /><br />

        👽 <strong>Lorwyn Changelings</strong> 👽
        <br />
        <i>"Expect the unexpected"</i>
        <br /><br />

        💠 <strong>Zendikar Hedrons</strong> 💠
        <br />
        <i>"Good Vibes, No Escape"</i>
        <br /><br />

        🐲 <strong>Tarkir Dragons</strong> 🐲
        <br />
        <i>"No cost too great"</i>
      </p>

      <div className="content-divider"></div>
    </Layout>
  );
}
