// these apply to ALL routes in the app
import './global.css'

export default function Home() {
	return (
		<main className='container'>
			<h1>Welcome to The Dynasty Cube</h1>
			<p className='subtitle'> A collabroative, living draft format!</p>
			<p className='construction-notice'>This sire is under construction!</p>
			<p>
				<a href="https://cubecobra.com/cube/overview/TheDynastyCube">
				Head to our CubeCobra page for details about the League while this website is being built.
				</a>
			</p>
		</main>

	); 
}
