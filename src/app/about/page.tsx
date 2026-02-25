// src/app/about/page.tsx
import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Separator } from "@/app/components/ui/separator";
import { Sparkles, Users, History, Trophy, Globe, Disc, ArrowRight } from "lucide-react";

export const metadata = {
  title: "About | The Dynasty Cube",
  description: "Learn about the living, collaborative draft format of The Dynasty Cube.",
};

const TEAMS = [
  { name: "Alara Shards", emoji: "🌟", motto: "Why not both?", color: "border-orange-500/30 bg-orange-500/5 text-orange-600 dark:text-orange-400" },
  { name: "Kamigawa Ninja", emoji: "⛩️", motto: "Omae wa mou shindeiru.", color: "border-indigo-500/30 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400" },
  { name: "Innistrad Creeps", emoji: "🧟", motto: "Braaaaaaiiiiins", color: "border-slate-500/30 bg-slate-500/5 text-slate-600 dark:text-slate-400" },
  { name: "Theros Demigods", emoji: "🌞", motto: "The Fates will decide", color: "border-yellow-500/30 bg-yellow-500/5 text-yellow-600 dark:text-yellow-400" },
  { name: "Ravnica Guildpact", emoji: "🔗", motto: "A Championship is won and lost before ever entering the battlefield.", color: "border-blue-500/30 bg-blue-500/5 text-blue-600 dark:text-blue-400" },
  { name: "Lorwyn Changelings", emoji: "👽", motto: "Expect the unexpected", color: "border-green-500/30 bg-green-500/5 text-green-600 dark:text-green-400" },
  { name: "Zendikar Hedrons", emoji: "💠", motto: "Good Vibes, No Escape", color: "border-cyan-500/30 bg-cyan-500/5 text-cyan-600 dark:text-cyan-400" },
  { name: "Tarkir Dragons", emoji: "🐲", motto: "No cost too great", color: "border-purple-500/30 bg-purple-500/5 text-purple-600 dark:text-purple-400" },
];

export default function AboutPage() {
  return (
    <div className="container max-w-4xl mx-auto px-4 py-12 space-y-16">
      
      {/* Introduction / Welcome */}
      <section className="text-center space-y-6">
        <div className="inline-flex items-center justify-center p-3 bg-purple-500/10 rounded-full mb-4">
          <Sparkles className="size-8 text-purple-500" />
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight bg-gradient-to-r from-foreground to-purple-500 bg-clip-text text-transparent">
          The Dynasty Cube
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          A collaborative, living draft league in which Teams draft through the history of Magic, beginning with the earliest sets of 1993, and culminating in a metagame shaped entirely by player choice.
        </p>
      </section>

      {/* The Ominous Hook */}
      <section>
        <Card className="border-l-4 border-l-purple-500 bg-muted/30">
          <CardContent className="p-6 md:p-8 italic text-muted-foreground space-y-4 text-lg">
            <p>
              &quot;It&apos;s that time of year again. The weather is getting warmer, and your commissioner is asking if you&apos;ll be participating again this season. You missed the playoffs last year, as usual. You contemplate why you do this every year...&quot;
            </p>
            <p>
              &quot;You think back on simpler times. <strong>Happier days.</strong> Days when you played Magic: The Gathering to get your social gaming fix. To scratch that strategic, creative itch.&quot;
            </p>
            <p className="font-semibold text-foreground mt-6 text-center">
              We have what you need. <span className="text-purple-500">What you crave.</span>
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Core Concepts */}
      <section className="space-y-8">
        <h2 className="text-3xl font-bold flex items-center gap-3">
          <Globe className="size-6 text-blue-500" />
          The Three Pillars
        </h2>
        <p className="text-lg text-muted-foreground">
          At its core, The Dynasty Cube combines a normal cube draft with the long-term planning of a dynasty sports league and the evolving horror of a community-driven simulation.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Disc className="size-5 text-purple-500" />
                Rotisserie Draft
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Instead of passing hidden packs, players make draft picks publicly, one at a time, from a massive known pool. Every pick is visible and influences the direction every other team takes.
            </CardContent>
          </Card>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="size-5 text-yellow-500" />
                Fantasy Sports
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Teams have one matchup per week, culminating in a playoff elimination tournament. Just like a dynasty league, teams can trade cards and future draft picks to improve their roster now or rebuild for the future.
            </CardContent>
          </Card>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-5 text-red-500" />
                Living Evolution
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Inspired by <a href="https://en.wikipedia.org/wiki/Blaseball" target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-foreground">Blaseball</a>, your decisions echo beyond the draft. Between seasons, Teams vote on new rules. Cards heavily drafted become harder to retain. The game plays you back.
            </CardContent>
          </Card>
        </div>
      </section>

      <Separator />

      {/* The Lore */}
      <section className="space-y-6">
        <h2 className="text-3xl font-bold flex items-center gap-3">
          <Sparkles className="size-6 text-indigo-500" />
          The Awakening
        </h2>
        <div className="bg-slate-950 text-slate-200 p-6 md:p-8 rounded-xl font-serif space-y-4 border border-slate-800 shadow-inner">
          <p>
            In the <strong>BEGINNING</strong>, <strong>The Cube</strong> was a Celestial - a sentient, cosmological being. For millennia it consumed, silently, slowly but purposefully, until nothing remained of its home plane. 
          </p>
          <p>
            Further eons passed without consequence, The Cube lying dormant until, quite suddenly - something changed. <em>The Dynasty Cube&apos;s Spark had ignited.</em> <strong>THE DYNASTY CUBE AWAKENS.</strong>
          </p>
          <p>
            With this new power, The Cube was no longer confined to its own barren plane - it could reach its tendrils to neighboring planes and pull in all it could ever desire. Something else had changed however - all that it consumed, it could still <em>sense</em>. What it pulled in from these neighboring planes still gave The Cube power, but now they were <em>within</em> The Cube. Part of it.
          </p>
          <p>
            <strong>THE LEAGUE IS FORMED.</strong> At first, there was only <em>chaos</em>. The displaced inhabitants of these disparate planes were lost, aimless, hopeless - trapped within a Celestial with unfathomable, seemingly infinite power. In time, like found like, and factions were formed, representatives of their home planes desperate for an escape.
          </p>
          <p className="text-center font-bold text-lg pt-4 tracking-widest text-white">
            THE BLIND ETERNITIES SHIFT.
          </p>
        </div>
      </section>

      <Separator />

      {/* How It Works */}
      <section className="space-y-8">
        <h2 className="text-3xl font-bold">How The League Works</h2>
        
        <div className="space-y-6 pl-4 border-l-2 border-muted">
          <div>
            <h3 className="text-xl font-semibold mb-2">1. The Draft</h3>
            <p className="text-muted-foreground">
              Picks are made in a serpentine pattern. After each team has made a single card selection, the pick order reverses (so the team that picked first then picks last). This repeats until each team has constructed their deck pool. Starting from Magic&apos;s earliest sets (ABUR, Arabian Nights, Antiquities, Legends), we draft sequentially through history.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-2">2. The Season</h3>
            <p className="text-muted-foreground">
              Teams pare down to a strict 35-card limit (excluding basic lands). Over the coming weeks, a designated Pilot from your team will play scheduled matches to determine the rankings, leading up to the Championship match. During this time, Teams may actively trade cards with one another—trades do not need to be equal.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-2">3. The Off-Season</h3>
            <p className="text-muted-foreground">
              After the Championship, the Multiverse shifts. Older cards become harder to retain in your pool, and the <em>next</em> chronological Magic set is injected into the Draft Pool. The Teams then convene to vote on new rules, shaping the environment for the coming Season.
            </p>
          </div>
        </div>
      </section>

      {/* The Teams */}
      <section className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold flex items-center gap-3 mb-2">
              <Users className="size-6 text-emerald-500" />
              The Factions
            </h2>
            <p className="text-muted-foreground">
              Participants are separated into 8 distinct teams. Each has a Captain (the sole arbiter of off-field decisions) and a Pilot (the designated player for weekly matches).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TEAMS.map((team) => (
            <Card key={team.name} className={`border-l-4 ${team.color} transition-all hover:shadow-md`}>
              <CardContent className="p-5 flex items-center gap-4">
                <span className="text-4xl">{team.emoji}</span>
                <div>
                  <h3 className="text-xl font-bold text-foreground">{team.name}</h3>
                  <p className="text-sm italic opacity-80">&quot;{team.motto}&quot;</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="pb-12 pt-8 text-center space-y-6">
        <p className="text-2xl font-serif italic text-muted-foreground">
          &quot;It&apos;s already here. There&apos;s no stopping it now.&quot;
        </p>
        <Button size="lg" className="h-14 px-8 text-lg" asChild>
          <a href="https://discord.gg/9cfVJF4yrt" target="_blank" rel="noopener noreferrer">
            Join the Discord
            <ArrowRight className="ml-2 size-5" />
          </a>
        </Button>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mt-4">
          Not sure which team suits you? Join as a Spectator or drop into our recruitment channel where teams will try to win you over.
        </p>
      </section>
      
    </div>
  );
}
