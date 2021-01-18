window.addEventListener("DOMContentLoaded", () => {
	// Setup location form submit handler
	document.getElementById("weather-form").addEventListener("submit", (e) => {
		e.preventDefault();
		getWeather();
	});

	// Set up show/hide listeners for collapse events for the #weather-warnings element,
	// to change show/hide button text.
	$("#weather-warnings")
		.on("hide.bs.collapse", function () {
			$("#toggle-warnings-button").text("Show weather warnings");
		})
		.on("show.bs.collapse", function () {
			$("#toggle-warnings-button").text("Hide weather warnings");
		});

	getUserLocationWeather();
});

// Get the user's current position from the browser geolocation API and immediately render weather if allowed
function getUserLocationWeather() {
	navigator.geolocation.getCurrentPosition(
		// Success
		(geolocationPosition) => {
			getCurrentConditionsFromLatLon(
				geolocationPosition.coords.latitude,
				geolocationPosition.coords.longitude,
				Config.openWeatherMapKey
			);

			hideSearchError();
			writeWeatherWarnings(
				geolocationPosition.coords.latitude,
				geolocationPosition.coords.longitude,
				Config.openWeatherMapKey
			);

			renderForecast(
				document.getElementById("multi-day-forecast"),
				geolocationPosition.coords.latitude,
				geolocationPosition.coords.longitude
			);

			// Show weather output element
			document.getElementById("weather-output").classList.remove("d-none");
		},
		// Failure
		(geolocationPositionError) => {
			console.error(geolocationPositionError);
			showSearchError(
				`Please allow your location to be detected or enter a city`
			);
		}
	);
}

async function getWeather() {
	document.getElementById("weather-output").classList.add("d-none");

	const city = document.getElementById("city-input").value;

	if (city === "") {
		showSearchError(`Please enter a city`);
		return;
	}

	// Get the specified location's current weather and return the lat/lon corresponding to that location
	const [lat, lon] = await getCurrentConditionsFromCity(
		city,
		Config.openWeatherMapKey
	);
	console.log(lat, lon);

	// Pass lat+lon data from OpenWeatherMap to the National Weather Service
	// Don't try to get a forecast if you encountered error lat lon values
	if (lat !== undefined && lon !== undefined) {
		hideSearchError();
		writeWeatherWarnings(lat, lon, Config.openWeatherMapKey);
		renderForecast(document.getElementById("multi-day-forecast"), lat, lon);

		// Show weather output element
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

// Fetch current weather conditions and add corresponding HTML elements to the page based on a specified city.
// Returns latitude and longitude associated with a location to avoid an additional
// geolocation lookup request.
async function getCurrentConditionsFromCity(city, apiKey) {
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

// Fetch current weather conditions and add corresponding HTML elements to the page based on a lat/lon pair.
// The lat/lon pair comes from a user's geolocation data so no return values are necessary.
async function getCurrentConditionsFromLatLon(lat, lon, apiKey) {
	const currentWeather = await fetch(
		`https:\\api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}`
	);

	if (currentWeather.status !== 200) {
		console.log("Error: " + currentWeather.status);
	}

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
		"Your location"
	);
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
		`<p>Right now in ${data.name}, it's ${kelvinToFahrenheitRounded(
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

// Returns 7-day forecast data for given latitude and longitude coordinates
async function getNWSForecastData(lat, lon) {
	const coordinateRequest = await fetch(
		`https://api.weather.gov/points/${lat},${lon}`
	);
	const coordinateData = await coordinateRequest.json();

	const nwsResponse = await fetch(coordinateData.properties.forecast);
	const nwsForecastData = await nwsResponse.json();
	// console.log(nwsForecastData);

	return nwsForecastData;
}

// Renders a 7-day forecast in a specified element for given latitude and longitude coordinates
async function renderForecast(targetDiv, lat, lon) {
	const nwsData = await getNWSForecastData(lat, lon);

	// Clear targetDiv's contents to avoid stacking weather forecast output
	targetDiv.innerHTML = "";

	// Add a card for each period of forecast data
	for (
		let forecastIndex = 0;
		forecastIndex < nwsData.properties.periods.length;
		forecastIndex++
	) {
		let timePeriodData = nwsData.properties.periods[forecastIndex];
		let timePeriodCard = document.createElement("div");
		timePeriodCard.classList.add("col-lg-4");
		timePeriodCard.classList.add("col-md-6");
		timePeriodCard.classList.add("mb-3");

		if (forecastIndex === nwsData.properties.periods.length - 2) {
			// Second-to-last forecast card
			timePeriodCard.classList.add("ml-lg-auto");
		} else if (forecastIndex === nwsData.properties.periods.length - 1) {
			// Last forecast card
			timePeriodCard.classList.add("mr-lg-auto");
		}

		timePeriodCard.innerHTML = `<div class="card h-100">
			<img src="${timePeriodData.icon}" class="card-img-top" alt="${timePeriodData.shortForecast} image" />
			<div class="card-body">
				<h5 class="card-title">${timePeriodData.name}</h5>
				<p class="card-text">${timePeriodData.detailedForecast}</p>
			</div>
		</div>`;

		targetDiv.appendChild(timePeriodCard);
	}
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
	if (str.length === 0) {
		return "Your Location";
	} else {
		const split = str.split(" ");
		const capitalized = [];

		for (const word of split) {
			capitalized.push(capitalizeFirstLetter(word));
		}

		return capitalized.join(" ");
	}
}

// Write weather warnings, or hide the containing element if none exist
async function writeWeatherWarnings(lat, lon, apiKey) {
	// Get weather warnings data from OpenWeatherMap
	const owmCurrentConditions = await fetch(
		`https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly&appid=${apiKey}`
	);

	const owmCurrentConditionsData = await owmCurrentConditions.json();

	// Reset existing warning data
	const weatherWarnings = document.getElementById("weather-warnings");
	weatherWarnings.innerHTML = "<h2>Weather Warnings</h2>";
	const weatherWarningsContainer = document.getElementById(
		"weather-warnings-container"
	);

	// Write each weather alert
	if (owmCurrentConditionsData.hasOwnProperty("alerts")) {
		for (let i = 0; i < owmCurrentConditionsData.alerts.length; i++) {
			weatherWarnings.insertAdjacentHTML(
				"beforeend",
				`${formatWeatherWarning(
					owmCurrentConditionsData.alerts[i].description
				)}`
			);
		}
		// Unhide weather-warnings
		weatherWarningsContainer.classList.remove("d-none");
	} else {
		// Hide weather-warnings
		weatherWarningsContainer.classList.add("d-none");
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
			${
				details.length === 0
					? ""
					: "<ul><li>" + details.join("</li><li>") + "</li></ul>"
			}
		</div>
	`;
}
