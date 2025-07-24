// components/HomePage.tsx
import React from 'react';

const HomePage: React.FC = () => {
  return (
    <>
      <h1>Welcome to The Dynasty Cube</h1>
      <p className="subtitle">A collaborative, living draft format</p>
      <p className="construction-notice">This site is under construction!</p>
      <p>
        <a href="https://cubecobra.com/cube/overview/TheDynastyCube">
          Head to our CubeCobra page for details about The League while this website is being built.
        </a>
      </p>
    </>
  );
};

export default HomePage;