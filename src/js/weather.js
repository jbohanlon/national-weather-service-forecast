window.addEventListener("DOMContentLoaded", () => {
	document.getElementById("weather-form").addEventListener("submit", (e) => {
		e.preventDefault();
		getWeather();
	});
});

async function getWeather() {
	document.getElementById("weather-output").classList.add("d-none");

	const city =
		document.getElementById("city-input").value === ""
			? "New York"
			: document.getElementById("city-input").value;

	const [lat, lon] = await getCurrentConditions(city, Config.openWeatherMapKey);
	console.log(lat, lon);

	// Don't try to get a forecast if you encountered error lat lon values
	if (lat !== undefined && lon !== undefined) {
		hideSearchError();
		getForecast(lat, lon, Config.openWeatherMapKey);
		document.getElementById("weather-output").classList.remove("d-none");
	} else {
		showSearchError(`Couldn't find ${escapeHtml(city)}`);
	}
}

// Replaces dangerous characters with equivalent HTML entities for safe display in HTML
function escapeHtml(str) {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function hideSearchError() {
	document.getElementById("errors").classList.add("d-none");
}

function showSearchError(errorMessage) {
	const searchErrorElement = document.getElementById("errors");

	searchErrorElement.innerHTML = errorMessage;
	searchErrorElement.classList.remove("d-none");
}

// Fetch current weather conditions and add corresponding HTML elements to the page.
// Returns latitude and longitude associated with a location to avoid an additional
// geolocation lookup request.
async function getCurrentConditions(city, apiKey) {
	const currentWeather = await fetch(
		`https:\\api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
			city
		)}&appid=${apiKey}`
	);

	if (currentWeather.status !== 200) {
		console.log("Error: " + currentWeather.status);
		return [undefined, undefined];
	}

	// console.log(currentWeather);

	const currentWeatherData = await currentWeather.json();
	console.log(currentWeatherData);

	writeCurrentConditions(
		document.getElementById("current-weather"),
		currentWeatherData
	);

	createMap(
		document.getElementById("windy"),
		currentWeatherData.coord.lat,
		currentWeatherData.coord.lon,
		city
	);

	return [currentWeatherData.coord.lat, currentWeatherData.coord.lon];
}

// Write current conditions to HTML
function writeCurrentConditions(targetDiv, data) {
	// Clear targetDiv's contents to avoid stacking weather data output
	targetDiv.innerHTML = "";

	// Add a relevant image
	targetDiv.insertAdjacentHTML(
		"beforeend",
		getWeatherImage(data.weather[0].icon, data.weather[0].main)
	);

	// Add corresponding text data
	targetDiv.insertAdjacentHTML(
		"beforeend",
		`<p>Right now in ${
			data.name
		}, it's ${kelvinToFahrenheitRounded(
			data.main.temp
		)} and feels like ${kelvinToFahrenheitRounded(data.main.feels_like)}</p>`
	);
}

// Return a rounded Fahrenheit temperature string when given a Kelvin temperature
function kelvinToFahrenheitRounded(temp) {
	return Math.round((temp - 273.15) * 1.8 + 32) + "&deg;F";
}

// Return an image corresponding to given weather conditions
function getWeatherImage(icon, description) {
	// TODO: Replace OWM images with better ones
	// Weather images from OWM: https://openweathermap.org/weather-conditions#Icon-list

	const imageUrlBeginning = "https://openweathermap.org/img/wn/";
	const imageUrlEnd = "@4x.png";

	return `<img class="current-weather-image" src="${
		imageUrlBeginning + icon + imageUrlEnd
	}" alt="${description}"/>`;
}

// Create a map corresponding to current weather conditions
function createMap(targetDiv, latitude, longitude, placeName) {
	// Clear targetDiv's contents to avoid stacking maps
	targetDiv.innerHTML = "";

	// Parameters to pass to Windy -- it's most efficient to pass as many as possible at the beginning
	const options = {
		key: Config.windyKey,
		lat: latitude,
		lon: longitude,
		zoom: 7,
	};

	// Initialize the Windy API
	windyInit(options, (windyAPI) => {
		const { map } = windyAPI;

		// Put a marker with the searched place name on the map
		L.popup()
			.setLatLng([latitude, longitude])
			.setContent(capitalizeWords(placeName))
			.openOn(map);
	});
}

// Return 5-day forecast data for given latitude and longitude coordinates.
// Also includes weather alerts for the given area if applicable.
async function getForecast(lat, lon, apiKey) {
	const owmForecast = await fetch(
		`https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly&appid=${apiKey}`
	);

	const owmForecastData = await owmForecast.json();
	console.log(owmForecastData);

	const nwsForecastData = await getNWSForecastData(lat, lon);

	console.log(nwsForecastData);

	writeForecast(
		document.getElementById("multi-day-forecast"),
		nwsForecastData,
		owmForecastData
	);
}

// Takes a latitude/longitude pair and returns forecast data for the current week
async function getNWSForecastData(lat, lon) {
	const coordinateRequest = await fetch(
		`https://api.weather.gov/points/${lat},${lon}`
	);
	const coordinateData = await coordinateRequest.json();

	const response = await fetch(coordinateData.properties.forecast);
	const responseData = await response.json();
	return responseData;
}

// Write forecast HTML
function writeForecast(targetDiv, nwsData, owmData) {
	// Clear targetDiv's contents to avoid stacking weather forecast output
	targetDiv.innerHTML = "";

	// Add a new div that holds the requested location's forecast data
	const forecastDiv = document.createElement("div");
	forecastDiv.setAttribute("class", "forecast-container");

	// Create a list to hold each day's forecast data and corresponding images
	const forecastList = document.createElement("ul");
	forecastList.classList.add("list-unstyled");
	forecastDiv.appendChild(forecastList);

	// Add a li for each period of forecast data
	for (
		let forecastIndex = 0;
		forecastIndex < nwsData.properties.periods.length;
		forecastIndex++
	) {
		let dayData = nwsData.properties.periods[forecastIndex];
		let day = document.createElement("li");
		day.setAttribute("class", "forecast-day");

		day.innerHTML = `<img class="current-weather-image"
		src="${dayData.icon}"
		alt="${dayData.shortForecast} image"/>
		<p class="text-center">${dayData.name}
		<p class="forecast-line text-center">${dayData.detailedForecast}</p>`;

		forecastList.appendChild(day);
	}

	// Write the forecast HTML to the page
	forecastDiv.appendChild(forecastList);
	targetDiv.appendChild(forecastDiv);

	writeWeatherWarnings(owmData);
}

// Returns a day string based on a given date in seconds.
// Takes forecast array index as an argument to handle time zone-related formatting issues.
function secondsToDayString(dateInSeconds, index) {
	let date = new Date(dateInSeconds * 1000);
	let today = new Date();

	if (index == 0) {
		// Formatting fix to account for time zones
		if (today.getHours() > 18 || today.getHours() < 4) {
			return "Overnight";
		} else {
			return "Today";
		}
	} else if (index == 1) {
		return "Tomorrow";
	}

	return date.toLocaleDateString("en-US", { weekday: "long" });
}

// Return a string with the first letter capitalized
function capitalizeFirstLetter(str) {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

// Return a string with the first letter of each word capitalized
function capitalizeWords(str) {
	const split = str.split(" ");
	const capitalized = [];

	for (const word of split) {
		capitalized.push(capitalizeFirstLetter(word));
	}

	return capitalized.join(" ");
}

// Write weather warnings, or hide the containing element if none exist
function writeWeatherWarnings(data) {
	// Reset existing warning data
	const weatherWarnings = document.getElementById("weather-warnings");
	weatherWarnings.innerHTML = "<h2>Weather Warnings</h2>";

	// TODO: Add show/hide button for warnings since they can take
	// up a lot of vertical space at the top of the screen.

	// Write each weather alert
	if (data.hasOwnProperty("alerts")) {
		for (let i = 0; i < data.alerts.length; i++) {
			weatherWarnings.insertAdjacentHTML(
				"beforeend",
				`${formatWeatherWarning(data.alerts[i].description)}`
			);
		}
		// Unhide warnings
		weatherWarnings.classList.remove("d-none");
	} else {
		// Hide warnings
		weatherWarnings.classList.add("d-none");
	}
}

// Return weather warning with line breaks and nicer formatting
function formatWeatherWarning(text) {
	const lines = text.split("*");
	const headline = lines[0];
	const details = lines.slice(1);

	return `
		<div class="alert alert-warning" role="alert">
			<p><strong>${headline}</strong></p>
			${details.length === 0 ? "" : "<ul><li>" + details.join("</li><li>") + "</li></ul>"}
		</div>
	`;
}

// TODO: See if you can get historical data through the NWS API

function getWeatherBackground(weather) {
	// TODO: Use some free images from Flickr (check usage rights!) to get cool weather-related backgrounds
	// Flickr API: https://www.flickr.com/services/api/
}
