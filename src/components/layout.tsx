// app/layout.tsx
import './globals.css';
import Navigation from './components/Navigation';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Navigation />
        <div className="container">
          {children}
        </div>
      </body>
    </html>
  );
}