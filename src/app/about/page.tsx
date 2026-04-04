// src/app/about/page.tsx

import React from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Separator } from "@/app/components/ui/separator";
import { Users, History, Trophy, Globe, Disc, ArrowRight, BookOpen } from "lucide-react";
import { getTeamsWithDetails } from "@/app/actions/teamActions";

export const metadata = {
  title: "About | The Dynasty Cube",
  description: "Learn about the living, collaborative draft format of The Dynasty Cube.",
};

export default async function AboutPage() {
  // Fetch teams directly on the server to ensure data is always up-to-date
  const { teams } = await getTeamsWithDetails();
  const sortedTeams = teams ? teams.sort((a, b) => a.name.localeCompare(b.name)) : [];

  return (
    <div className="container max-w-4xl mx-auto px-4 py-12 space-y-16">
      {/* Introduction / Welcome with Large Fading Background Logo */}
      <section className="relative text-center space-y-6 pt-16 pb-8 md:pt-24 md:pb-12">
        {/* Container for the large, faded background logo. */}
        <div className="absolute top-0 inset-x-0 flex justify-center items-start h-[400px] z-0 overflow-hidden pointer-events-none">
          <Image
            src="/images/logo/logo.jpg"
            alt=""
            width={480}
            height={480}
            aria-hidden="true"
            // Removed the incorrect opacity class. The mask now operates on a fully opaque image.
            style={{
              maskImage: "linear-gradient(to bottom, black 40%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, black 40%, transparent 100%)", // Vendor prefix for Safari
            }}
          />
        </div>

        {/* Content wrapper with a positive z-index to ensure it's on top */}
        <div className="relative z-10">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground">
            The Dynasty Cube
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            A collaborative, living draft league in which Teams draft through the history of Magic, beginning with the earliest sets of 1993, and culminating in a metagame shaped entirely by player choice.
          </p>
        </div>
      </section>

      {/* The Ominous Hook */}
      <section>
        <Card className="border-l-4 border-l-ring bg-muted/30">
          <CardContent className="p-6 md:p-8 italic text-muted-foreground space-y-5 text-lg">
            <p className="text-foreground font-medium">
              &quot;Good. You&apos;re here.&quot;
            </p>
            <p>
              &quot;Are you interested in playing through the entire history of Magic: The Gathering from its beginning?&quot;
            </p>
            <p>
              &quot;Do you love Legacy-style games that continue to grow and evolve as a consequence of the actions you and your fellow players take?&quot;
            </p>
            <p>
              &quot;Does <span className="font-semibold text-foreground">the ominous horror of things beyond your comprehension creeping into this world</span> bring you joy?&quot;
            </p>
            <p className="font-bold text-foreground mt-8 text-center text-xl not-italic tracking-wide uppercase">
              We have what you need. <span className="font-semibold">What you crave.</span>
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
                <Disc className="size-5 text-primary" />
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
        <h2 className="text-3xl font-bold flex items-center justify-center gap-3 text-center">
          <BookOpen className="size-6 text-muted-foreground" />
          The Awakening
        </h2>
        <div className="bg-slate-950 text-slate-200 p-6 md:p-8 rounded-xl font-serif space-y-5 border border-slate-800 shadow-inner text-center">
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
          <p className="font-bold text-lg pt-4 tracking-widest text-white">
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
              Each round, each Team picks one card from the Draft Pool at a time, in reverse standings order from the previous Season. This repeats until each Team has constructed their Team Pool. Starting from Magic&apos;s earliest sets (ABUR, Arabian Nights, Antiquities, Legends), we draft sequentially through history.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-2">2. The Season</h3>
            <p className="text-muted-foreground">
              Over the coming weeks, teams will construct their decks from their drafted pools and play scheduled matches to determine the rankings, leading up to the Championship match. During this time, Teams collaborate on strategies and may actively trade cards with one another—trades do not need to be equal.
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
              Participants are separated into 8 distinct factions. Together, team members collaborate in private channels to discuss draft strategies, evaluate trades, build their decks, and vote on the future rules of the league.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sortedTeams.length > 0 ? (
            sortedTeams.map((team) => {
              // Changed purple fallback to a neutral gray
              const primaryColor = team.primary_color || "#6b7280";
              
              return (
                <Card 
                  key={team.id} 
                  className="border-l-4 transition-all hover:shadow-md"
                  style={{
                    borderLeftColor: primaryColor,
                    backgroundColor: `${primaryColor}10`, // Appends hex opacity for a subtle 6% tint
                  }}
                >
                  <CardContent className="p-5 flex items-center gap-4">
                    <span className="text-4xl drop-shadow-sm">{team.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <h3 
                        className="text-xl font-bold truncate" 
                        style={{ color: primaryColor }}
                      >
                        {team.name}
                      </h3>
                      <p className="text-sm italic opacity-80 text-foreground truncate">
                        &quot;{team.motto}&quot;
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="col-span-1 sm:col-span-2 text-center py-8 text-muted-foreground">
              Loading teams...
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="pb-12 pt-16 text-center space-y-6">
        <div className="max-w-2xl mx-auto space-y-4 mb-8">
          <h2 className="text-3xl font-bold">Shape the Multiverse</h2>
          <p className="text-muted-foreground text-lg">
            The Dynasty Cube is more than just a draft—it&apos;s a living community. Whether you&apos;re strategizing in private team channels, negotiating blockbuster trades with rivals, or voting on the cosmic rules that will shape the next era, your voice matters.
          </p>
        </div>
        
        <p className="text-2xl font-serif italic text-muted-foreground mb-6">
          &quot;It&apos;s already here. There&apos;s no stopping it now.&quot;
        </p>
        
        <Button size="lg" className="h-14 px-8 text-lg" asChild>
          <a href="https://discord.gg/9cfVJF4yrt" target="_blank" rel="noopener noreferrer">
            Join the Discord
            <ArrowRight className="ml-2 size-5" />
          </a>
        </Button>
        
        <p className="text-sm text-muted-foreground max-w-md mx-auto mt-6">
          Join the server, find your faction, and leave your mark on the Cube.
        </p>
      </section>
      
    </div>
  );
}
