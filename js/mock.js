// Valeurs statiques de test, au même format que hass.states de Home Assistant.
// Pour passer au réel, il suffira de remplacer cet objet par les états HA.
(function () {
  const S = {};
  const s = (id, state, attributes = {}) => (S[id] = { entity_id: id, state: String(state), attributes });
  const now = new Date();
  const iso = (d) => d.toISOString();
  const todayAt = (h, m) => { const d = new Date(now); d.setHours(h, m, 0, 0); return d; };

  // Solaire
  s("sensor.production_pv_maison_totale_w", 4850, { unit_of_measurement: "W" });
  s("sensor.izypower_safe_power", 1920, { unit_of_measurement: "W" });
  s("sensor.deye_safe_power", 1880, { unit_of_measurement: "W" });
  s("sensor.deye1k_safe_power", 1050, { unit_of_measurement: "W" });
  s("sensor.production_pv_jour", 14.2, { unit_of_measurement: "kWh" });
  s("sensor.solcast_pv_forecast_previsions_pour_aujourd_hui", 21.5, { unit_of_measurement: "kWh" });

  // Réseau
  s("sensor.te31njn2n154747_l3_p", -380, { unit_of_measurement: "W" });
  s("sensor.linky_import_today", 1.8, { unit_of_measurement: "kWh" });
  s("sensor.linky_export_today", 3.1, { unit_of_measurement: "kWh" });

  // Batterie (inversée : charge en négatif)
  s("sensor.solarflow_2400_ac_electric_level", 76, { unit_of_measurement: "%" });
  s("sensor.solarflow_2400_ac_bat_in_out", -1100, { unit_of_measurement: "W" });
  s("number.solarflow_2400_ac_min_soc", 10, { min: 0, max: 50, step: 5 });
  s("number.solarflow_2400_ac_soc_set", 100, { min: 70, max: 100, step: 5 });
  s("sensor.solarflow_2400_ac_hyper_tmp", 24, { unit_of_measurement: "°C" });
  s("sensor.solarflow_2400_ac_available_kwh", 6.4, { unit_of_measurement: "kWh" });
  s("sensor.batterie_charge_jour", 5.2, { unit_of_measurement: "kWh" });
  s("sensor.batterie_decharge_jour", 3.9, { unit_of_measurement: "kWh" });
  s("sensor.solarflow_2400_ac_aggr_charge", 1820.5, { unit_of_measurement: "kWh" });
  s("sensor.solarflow_2400_ac_aggr_discharge", 1652.3, { unit_of_measurement: "kWh" });
  [["01325", 78, 380, 23], ["01613", 75, 360, 24], ["09635", 75, 360, 25]].forEach(([n, soc, w, t]) => {
    s(`sensor.ab3000_${n}_soc_level`, soc, { unit_of_measurement: "%" });
    s(`sensor.ab3000_${n}_power`, w, { unit_of_measurement: "W" });
    s(`sensor.ab3000_${n}_max_temp`, t, { unit_of_measurement: "°C" });
  });

  // Voiture
  s("sensor.e_niro_e_niro_e_niro_ev_battery_level", 62, { unit_of_measurement: "%" });
  s("switch.e_niro_e_niro_ev_charging", "on");
  s("binary_sensor.e_niro_e_niro_e_niro_ev_battery_plug", "on");
  s("lock.e_niro_e_niro_e_niro_door_lock", "locked");
  s("switch.e_niro_e_niro_climate", "off");
  s("switch.e_niro_off_peak_charge_only", "off");
  s("switch.e_niro_scheduled_charging", "off");
  s("input_number.voltia_session_soc", 14);
  s("input_number.voltia_session_sol_kwh", 6.8);
  s("input_number.voltia_session_res_kwh", 2.1);
  s("input_datetime.voltia_session_debut", iso(todayAt(9, 12)));
  s("input_number.eniro_soc_reference", 71);
  s("input_datetime.eniro_dernier_trajet", iso(new Date(now - 26 * 3600e3)));
  s("sensor.te31njn2n154747_l2_p", 2300, { unit_of_measurement: "W" });
  s("number.e_niro_e_niro_e_niro_ac_charging_limit", 80, { min: 50, max: 100, step: 10 });
  s("number.e_niro_e_niro_e_niro_dc_charging_limit", 90, { min: 50, max: 100, step: 10 });
  s("sensor.e_niro_e_niro_e_niro_ev_range", 287, { unit_of_measurement: "km" });
  s("sensor.e_niro_e_niro_e_niro_estimated_charge_duration", 95, { unit_of_measurement: "min" });
  s("sensor.e_niro_e_niro_e_niro_last_updated_at", iso(new Date(now - 12 * 60e3)));
  s("button.e_niro_e_niro_force_refresh", "unknown");
  s("sensor.e_niro_e_niro_e_niro_car_battery_level", 88, { unit_of_measurement: "%" });
  s("sensor.ve_energie_solaire_kwh", 142.6, { unit_of_measurement: "kWh" });
  s("sensor.ve_energie_reseau_kwh", 58.3, { unit_of_measurement: "kWh" });
  s("sensor.ve_puissance_solaire", 2300, { unit_of_measurement: "W" });
  s("sensor.ve_puissance_reseau", 0, { unit_of_measurement: "W" });
  s("sensor.e_niro_e_niro_e_niro_odometer", 48250, { unit_of_measurement: "km" });
  s("input_number.eniro_dernier_entretien_km", 45000);

  // Tarifs
  s("sensor.hv_prix_kwh", 0.2302, { unit_of_measurement: "€/kWh" });
  s("sensor.hv_eco_reel_jour", 2.84, { unit_of_measurement: "€" });
  s("sensor.hv_eco_reel_total", 950, { unit_of_measurement: "€" });
  s("input_number.tarif_hp", 0.2302);
  s("input_number.tarif_hc", 0.1576);
  s("input_number.tarif_hsc", 0.1335);
  s("input_datetime.hsc_debut", "02:00:00");

  // Domotique
  const lum = { cuisine: "on", table_a_manger: "off", entree: "off", couloir: "on", bureau: "on", chambre_amoureux: "off", sport_room: "off" };
  Object.entries(lum).forEach(([k, v]) => s(`light.meross_${k}`, v));
  const vol = { facade: 100, facade_2: 100, cuisine: 60, bureau: 100, chambre: 0, salle_de_bain: 30, cote: 100, arriere: 100, arriere_2: 0 };
  Object.entries(vol).forEach(([k, v]) =>
    s(`cover.all_house_${k}`, v === 0 ? "closed" : "open", { current_position: v }));
  s("switch.chambre_eve_energy", "on");
  s("sensor.chambre_eve_energy_puissance", 45, { unit_of_measurement: "W" });
  s("sensor.chambre_eve_energy_energie", 1.2, { unit_of_measurement: "kWh" });
  ["on", "on", "off", "off", "on"].forEach((v, i) => s(`switch.smart_power_strip_commutateur_${i + 1}`, v));
  s("vacuum.robovac", "docked", { friendly_name: "RoboVac", fan_speed: "Standard", fan_speed_list: ["Pure", "Standard", "Turbo", "Max"], cleaned_area: 46, cleaning_time: 52, last_clean: new Date(Date.now() - 26 * 3600e3).toISOString() });
  s("sensor.robovac_battery", 100, { unit_of_measurement: "%" });
  s("select.robovac_scene", "Tout le rez-de-chaussée", { options: ["Tout le rez-de-chaussée", "Cuisine", "Salon", "Chambres"] });
  s("media_player.salon", "playing", { media_title: "Midnight City", media_artist: "M83", media_album_name: "Hurry Up, We're Dreaming", media_duration: 243, media_position: 97, volume_level: 0.35, entity_picture: "" });

  // Chauffage
  s("climate.poele", "heat", { current_temperature: 20.4, temperature: 21, min_temp: 15, max_temp: 25 });
  s("sensor.poele_status", "Allumé");
  s("number.poele_power", 3, { min: 1, max: 5, step: 1 });
  s("sensor.poele_smoke_temperature", 145, { unit_of_measurement: "°C" });
  s("sensor.poele_air_temperature", 20.4, { unit_of_measurement: "°C" });
  s("input_number.pellet_reservoir_poele_kg", 9, { max: 30 });
  s("input_number.pellet_stock_maison_kg", 210);
  s("input_number.pellet_consumption_per_day_kg", 6.5);
  s("script.fill_stove_from_maison", "off");
  s("script.add_pellets_to_maison", "off");
  s("input_datetime.entretien_poele", "2025-11-15");
  [["", "heat", 19.5, 19], ["_2", "off", 17, 16.8], ["_3", "heat", 18.5, 18.1], ["_4", "heat", 22, 21.2]].forEach(([n, mode, cible, cur]) =>
    s(`climate.pass_actuator${n}`, mode, { temperature: cible, current_temperature: cur, min_temp: 5, max_temp: 28 }));
  s("sensor.gamingroom_temperature", 19.1, { unit_of_measurement: "°C" });
  s("sensor.chambre_sport_temperature", 16.9, { unit_of_measurement: "°C" });
  s("sensor.chambre_69_temperature", 18.2, { unit_of_measurement: "°C" });
  s("sensor.gamingroom_humidity", 48, { unit_of_measurement: "%" });
  s("sensor.chambre_sport_humidity", 55, { unit_of_measurement: "%" });
  s("sensor.chambre_69_humidity", 51, { unit_of_measurement: "%" });
  s("water_heater.ballon_eau_chaude", "eco", { temperature: 55, min_temp: 40, max_temp: 65 });
  s("sensor.ballon_eau_chaude_middle_water_temperature", 52, { unit_of_measurement: "°C" });
  s("binary_sensor.ballon_eau_chaude_energy_demand_status", "off");
  s("number.ballon_eau_chaude_boost_mode_duration", 0, { min: 0, max: 1 });
  s("input_datetime.entretien_ballon", "2025-03-10");

  // Météo
  s("weather.homelyvibes_sa", "sunny", { temperature: 18, humidity: 62, wind_speed: 12 });

  window.MOCK_STATES = S;
})();
