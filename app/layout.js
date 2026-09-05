export const metadata = {
  title: 'Sport Tracker',
  description: 'API for the lock screen sport/yoga tracker wallpaper',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
