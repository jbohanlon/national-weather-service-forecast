window.addEventListener("DOMContentLoaded", () => {
	document.getElementById("weather-form").addEventListener("submit", (e) => {
		e.preventDefault();
		getWeather();
	});
});

async function getWeather() {
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
	document.getElementById("search-error").classList.add("d-none");
}

function showSearchError(errorMessage) {
	const searchErrorElement = document.getElementById("search-error");

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
		document
			.getElementById("searched-city-current-conditions")
			.insertAdjacentHTML("beforeend", "<p>Invalid city</p>");
		return [undefined, undefined];
	}

	// console.log(currentWeather);

	const currentWeatherData = await currentWeather.json();
	console.log(currentWeatherData);

	writeCurrentConditions(
		document.getElementById("current-weather-container"),
		currentWeatherData
	);

	createMap(
		document.getElementById("windy"),
		currentWeatherData.coord.lat,
		currentWeatherData.coord.lon,
		city
	);

	// Unhide current-weather-container and windy at the same time so load times don't create inconsistent heights or jumpy content
	document
		.getElementById("current-weather-container")
		.classList.remove("d-none");
	document.getElementById("windy").classList.remove("d-none");

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
		`<p class="text-center w-50">Right now in ${data.name}, ${
			data.sys.country
		} it's ${kelvinToFahrenheitRounded(
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

	// Set map's height to equal its container.
	// Leaflet maps must have a defined height so this is here to guarantee that.
	document.getElementById("windy").setAttribute("height", "100%");

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
	const forecast = await fetch(
		`https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly&appid=${apiKey}`
	);

	// console.log(forecast);

	const forecastData = await forecast.json();
	console.log(forecastData);

	writeForecast(
		document.getElementById("searched-city-forecast"),
		forecastData
	);
}

// Write forecast HTML
function writeForecast(targetDiv, data) {
	// Clear targetDiv's contents to avoid stacking weather forecast output
	targetDiv.innerHTML = "";

	// Add a new div that holds the requested location's forecast data
	const forecastDiv = document.createElement("div");
	forecastDiv.setAttribute("class", "forecast-container");

	// Create a list to hold each day's forecast data and corresponding images
	const forecastList = document.createElement("ul");
	forecastDiv.appendChild(forecastList);

	// Add a li for each day of forecast data
	for (
		let forecastIndex = 0;
		forecastIndex < data.daily.length;
		forecastIndex++
	) {
		let day = document.createElement("li");

		day.setAttribute("class", "forecast-day");

		day.innerHTML = `${getWeatherImage(
			data.daily[forecastIndex].weather[0].icon,
			capitalizeFirstLetter(data.daily[forecastIndex].weather[0].description)
		)}<p class="forecast-line text-center">${secondsToDayString(
			data.daily[forecastIndex].dt,
			forecastIndex
		)}: ${capitalizeFirstLetter(
			data.daily[forecastIndex].weather[0].description
		)}, with a high of ${kelvinToFahrenheitRounded(
			data.daily[forecastIndex].temp.max
		)} and a low of ${kelvinToFahrenheitRounded(
			data.daily[forecastIndex].temp.min
		)}</p>`;

		forecastList.appendChild(day);
	}

	// Write the forecast HTML to the page
	forecastDiv.appendChild(forecastList);
	targetDiv.appendChild(forecastDiv);

	writeWeatherWarnings(data);
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
	const warnings = document.getElementById("warnings");
	warnings.innerHTML = "<h2>Weather Warnings</h2>";

	// Write each weather alert
	if (data.hasOwnProperty("alerts")) {
		// Unhide warnings
		warnings.classList.remove("d-none");

		for (let i = 0; i < data.alerts.length; i++) {
			warnings.insertAdjacentHTML(
				"beforeend",
				`<div>${formatWeatherWarning(data.alerts[i].description)}</div>`
			);
		}
	} else {
		// Hide warnings
		warnings.classList.add("d-none");
	}
}

// Return weather warning with line breaks and nicer formatting
function formatWeatherWarning(text) {
	const split = text.split("*");
	const warnings = [];

	for (let i = 0; i < split.length; i++) {
		let sentence = split[i];

		// Format warning headline and text
		if (i == 0) {
			sentence = sentence.replace(/\.\.\./g, "");
			warnings.push(
				`<p class="weather-warning-headline">${sentence.trim()}</p>`
			);
		} else {
			sentence = sentence.replace("...", " &mdash; ");
			warnings.push(
				`<p class="weather-warning-text">&bull;${sentence.trim()}</p>`
			);
		}
	}

	return warnings.join("");
}

// TODO: See if you can get historical data through the NWS API

function getWeatherBackground(weather) {
	// TODO: Use some free images from Flickr (check usage rights!) to get cool weather-related backgrounds
	// Flickr API: https://www.flickr.com/services/api/
}
