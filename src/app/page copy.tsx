// these apply to ALL routes in the app
import './global.css'

export default function Home() {
	return (
		<>
		<nav className="nav">
			<div className="nav-container">
				<button className="menu-toggle" onClick="toggleMenu()">Menu</button>
				<ul className='nav-menu' id="navmenu">
					<li><a href="#" className='nav-link'>Home</a></li>
				    <li><a href="#" className="nav-link">About</a></li>
     				<li><a href="#" className="nav-link">Rules</a></li>
					<li><a href="https://cubecobra.com/cube/overview/TheDynastyCube" class="nav-link">CubeCobra</a></li>
				</ul>
			</div>
		</nav>
		<div className='container'>
			<h1>Welcome to The Dynasty Cube</h1>
			<p className='subtitle'> A collabroative, living draft format!</p>
			<p className='construction-notice'>This sire is under construction!</p>
			<p>
				<a href="https://cubecobra.com/cube/overview/TheDynastyCube">
				Head to our CubeCobra page for details about the League while this website is being built.
				</a>
			</p>
		</div>
		</>
	); 
}
