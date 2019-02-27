repos();		

window.onresize = repos;

function repos() {
	var height = window.innerHeight;
	var logoHeight = 423;
	var mt = ( ( height - logoHeight ) / 2 );

	if (mt > 0) {
		document.getElementsByTagName("body")[0].style.marginTop = mt + 'px';	
	}
}
