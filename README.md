# TAM Live

Carte temps réel des trams et bus de Montpellier, pour Expo Go.

L’app interroge le flux officiel GTFS-RT de TaM toutes les 10 secondes et place chaque véhicule sur la carte, avec la couleur de sa ligne.

## Lancer dans Expo Go

```bash
npm install
npx expo start
```

Scanne le QR code avec Expo Go (SDK 58). Le téléphone et l’ordinateur doivent être sur le même réseau.

- **Carte** : tous les véhicules, filtres Tram / Bus, et les lignes 1 à 5.
- **Lignes** : les 44 lignes du réseau. Toucher une ligne recentre la carte dessus.
- **Moi** demande la position pour se situer. **Réseau** recadre les véhicules affichés.

## Données

Positions : <https://gtfsproxy.e-tam.fr/COMMON/VehiclePosition.pb>

Référentiel des lignes : <https://gtfsproxy.e-tam.fr/COMMON/GTFS.zip>

Source : Montpellier Méditerranée Métropole / TaM, licence [ODbL](https://opendatacommons.org/licenses/odbl/). Pour régénérer le catalogue des lignes :

```bash
python3 scripts/refresh-network.py
```

Les vitesses aberrantes parfois présentes dans le flux (au-delà de 110 km/h) ne sont pas affichées.
