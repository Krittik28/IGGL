from django.core.management.base import BaseCommand
from gta.services.uft_service import sync_uft_master_paths


class Command(BaseCommand):
    help = 'Sync UFT master paths from SAP OData feed (or local seed XML fallback)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force-seed',
            action='store_true',
            help='Force use of local seed XML instead of attempting SAP OData fetch',
        )

    def handle(self, *args, **options):
        force_seed = options['force_seed']
        result = sync_uft_master_paths(force_seed=force_seed)
        self.stdout.write(f"Source      : {result['source']}")
        self.stdout.write(f"Synced      : {result['count']} paths")
        self.stdout.write(f"Deactivated : {result.get('deactivated', 0)} stale paths")
        self.stdout.write('')
        for p in result['paths']:
            self.stdout.write(
                f"  {p['uft_id']:20s} | {p['path_id_desc']:35s} | {p['zone_pngrb']} | tariff={p['applicable_tariff_regime']}"
            )
        if result['success']:
            self.stdout.write(self.style.SUCCESS('\nUFT sync completed successfully.'))
