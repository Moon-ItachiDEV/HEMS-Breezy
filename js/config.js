// Correspondance rôle Breezy HEMS → entité Home Assistant (copie de la config voltia.entities).
// Le design ne lit jamais une entité directement : il passe toujours par ces rôles.
window.VOLTIA_CONFIG = {
  // ─── Solaire
  solaire_w: "sensor.production_pv_maison_totale_w",
  onduleurs_w: ["sensor.izypower_safe_power", "sensor.deye_safe_power", "sensor.deye1k_safe_power"],
  onduleurs_noms: ["Izy 2 000 W", "Deye 2 000 W", "Deye 1 000 W"],
  production_jour_kwh: "sensor.production_pv_jour",
  prevision_jour_kwh: "sensor.solcast_pv_forecast_previsions_pour_aujourd_hui",

  // ─── Réseau (+ import, − export)
  reseau_w: "sensor.te31njn2n154747_l3_p",
  import_jour_kwh: "sensor.linky_import_today",
  export_jour_kwh: "sensor.linky_export_today",

  // ─── Batterie
  batterie_soc: "sensor.solarflow_2400_ac_electric_level",
  batterie_w: "sensor.solarflow_2400_ac_bat_in_out",
  batterie_inverse: true,
  batterie_min_pct: "number.solarflow_2400_ac_min_soc",
  batterie_max_pct: "number.solarflow_2400_ac_soc_set",
  batterie_temp: "sensor.solarflow_2400_ac_hyper_tmp",
  batterie_dispo_kwh: "sensor.solarflow_2400_ac_available_kwh",
  batterie_charge_jour_kwh: "sensor.batterie_charge_jour",
  batterie_decharge_jour_kwh: "sensor.batterie_decharge_jour",
  batterie_total_charge_kwh: "sensor.solarflow_2400_ac_aggr_charge",
  batterie_total_decharge_kwh: "sensor.solarflow_2400_ac_aggr_discharge",
  packs_soc: ["sensor.ab3000_01325_soc_level", "sensor.ab3000_01613_soc_level", "sensor.ab3000_09635_soc_level"],
  packs_w: ["sensor.ab3000_01325_power", "sensor.ab3000_01613_power", "sensor.ab3000_09635_power"],
  packs_temp: ["sensor.ab3000_01325_max_temp", "sensor.ab3000_01613_max_temp", "sensor.ab3000_09635_max_temp"],

  // ─── Voiture
  voiture_soc: "sensor.e_niro_e_niro_e_niro_ev_battery_level",
  voiture_en_charge: "switch.e_niro_e_niro_ev_charging",
  voiture_branchee: "binary_sensor.e_niro_e_niro_e_niro_ev_battery_plug",
  voiture_verrou: "lock.e_niro_e_niro_e_niro_door_lock",
  voiture_clim: "switch.e_niro_e_niro_climate",
  voiture_heures_creuses: "switch.e_niro_off_peak_charge_only",
  voiture_programmee: "switch.e_niro_scheduled_charging",
  session_soc: "input_number.voltia_session_soc",
  session_sol_kwh: "input_number.voltia_session_sol_kwh",
  session_res_kwh: "input_number.voltia_session_res_kwh",
  session_debut: "input_datetime.voltia_session_debut",
  voiture_soc_reference: "input_number.eniro_soc_reference",
  voiture_dernier_trajet: "input_datetime.eniro_dernier_trajet",
  voiture_charge_w: "sensor.te31njn2n154747_l2_p",
  voiture_limite_pct: "number.e_niro_e_niro_e_niro_ac_charging_limit",
  voiture_limite_dc_pct: "number.e_niro_e_niro_e_niro_dc_charging_limit",
  voiture_autonomie_km: "sensor.e_niro_e_niro_e_niro_ev_range",
  voiture_minutes_restantes: "sensor.e_niro_e_niro_e_niro_estimated_charge_duration",
  voiture_maj: "sensor.e_niro_e_niro_e_niro_last_updated_at",
  voiture_rafraichir: "button.e_niro_e_niro_force_refresh",
  voiture_capacite_kwh: 64,
  voiture_conso_kwh_100km: 16.5,                       // conso moyenne de la e-Niro (pour le coût au 100 km)
  essence_l_100km: 6.5, essence_prix_l: 1.85,           // voiture essence de comparaison
  voiture_12v_pct: "sensor.e_niro_e_niro_e_niro_car_battery_level",
  ve_solaire_kwh: "sensor.ve_energie_solaire_kwh",
  ve_reseau_kwh: "sensor.ve_energie_reseau_kwh",
  ve_solaire_w: "sensor.ve_puissance_solaire",
  ve_reseau_w: "sensor.ve_puissance_reseau",
  voiture_odometre: "sensor.e_niro_e_niro_e_niro_odometer",
  entretien_dernier_km: "input_number.eniro_dernier_entretien_km",
  entretien_intervalle_km: 15000,

  // ─── Tarifs
  prix_kwh: "sensor.hv_prix_kwh",
  economies_jour_eur: "sensor.hv_eco_reel_jour",
  economies_total_eur: "sensor.hv_eco_reel_total",      // à vérifier : le capteur qui affiche le cumul (≈ 950 €) dans HA
  solaire_investissement_eur: 4400,                     // un nombre : ce que l'installation solaire a coûté
  solaire_mise_en_service: "2025-03-01",                // à corriger : la date de mise en service (AAAA-MM-JJ)
  tarif_hp: "input_number.tarif_hp",
  tarif_hc: "input_number.tarif_hc",
  tarif_hsc: "input_number.tarif_hsc",
  tarif_hsc_debut: "input_datetime.hsc_debut",
  plages_tarifaires: {                                  // à confirmer : HP = tout le reste (7h → 23h)
    hsc: ["02:00-06:00"],
    hc: ["23:00-02:00", "06:00-07:00"],
  },

  // ─── Domotique
  lumieres: [
    "light.meross_cuisine", "light.meross_table_a_manger", "light.meross_entree", "light.meross_couloir",
    "light.meross_bureau", "light.meross_chambre_amoureux", "light.meross_sport_room",
  ],
  lumieres_noms: ["Cuisine", "Table à manger", "Entrée", "Couloir", "Bureau", "Chambre", "Salle de sport"],
  volets: [
    "cover.all_house_facade", "cover.all_house_facade_2", "cover.all_house_cuisine", "cover.all_house_bureau",
    "cover.all_house_chambre", "cover.all_house_salle_de_bain", "cover.all_house_cote", "cover.all_house_arriere",
    "cover.all_house_arriere_2",
  ],
  volets_noms: ["Façade", "Façade 2", "Cuisine", "Bureau", "Chambre", "Salle de bain", "Côté", "Arrière", "Arrière 2"],
  prise_chambre: "switch.chambre_eve_energy",
  prise_chambre_w: "sensor.chambre_eve_energy_puissance",
  prise_chambre_kwh: "sensor.chambre_eve_energy_energie",
  multiprise: [
    "switch.smart_power_strip_commutateur_1", "switch.smart_power_strip_commutateur_2",
    "switch.smart_power_strip_commutateur_3", "switch.smart_power_strip_commutateur_4",
    "switch.smart_power_strip_commutateur_5",
  ],
  multiprise_noms: ["Prise 1", "Prise 2", "Prise 3", "Prise 4", "USB"],
  robot: "vacuum.robovac",
  robot_batterie: "sensor.robovac_battery",
  robot_scene: "select.robovac_scene",
  homepod: "media_player.salon",

  // ─── Chauffage
  poele: "climate.poele",
  poele_statut: "sensor.poele_status",
  poele_puissance: "number.poele_power",
  poele_fumees: "sensor.poele_smoke_temperature",
  poele_air: "sensor.poele_air_temperature",
  tremie_kg: "input_number.pellet_reservoir_poele_kg",
  stock_kg: "input_number.pellet_stock_maison_kg",
  conso_jour_kg: "input_number.pellet_consumption_per_day_kg",
  script_remplir: "script.fill_stove_from_maison",
  script_achat: "script.add_pellets_to_maison",
  poele_entretien: "input_datetime.entretien_poele",
  poele_entretien_mois: 12,
  radiateurs: ["climate.pass_actuator", "climate.pass_actuator_2", "climate.pass_actuator_3", "climate.pass_actuator_4"],
  radiateurs_noms: ["Bureau", "Salle de sport", "Chambre", "Salle de bain"],
  radiateurs_temp: ["sensor.gamingroom_temperature", "sensor.chambre_sport_temperature", "sensor.chambre_69_temperature", ""],
  radiateurs_hum: ["sensor.gamingroom_humidity", "sensor.chambre_sport_humidity", "sensor.chambre_69_humidity", ""],
  ballon: "water_heater.ballon_eau_chaude",
  ballon_temp: "sensor.ballon_eau_chaude_middle_water_temperature",
  ballon_chauffe: "binary_sensor.ballon_eau_chaude_energy_demand_status",
  ballon_boost: "number.ballon_eau_chaude_boost_mode_duration",
  ballon_entretien: "input_datetime.entretien_ballon",

  // ─── Météo
  meteo: "weather.homelyvibes_sa",
};
