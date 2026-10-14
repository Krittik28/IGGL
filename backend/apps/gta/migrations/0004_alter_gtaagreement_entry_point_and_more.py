# Generated manually for GTA optional entry/exit and validity fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('gta', '0003_gtaagreement_bank_guarantee_amount_figures_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='gtaagreement',
            name='entry_point',
            field=models.CharField(blank=True, default='IGGL Grid Injection Point', help_text='Gas Injection Point, e.g. Duliajan, Vijaipur, Dahej', max_length=100),
        ),
        migrations.AlterField(
            model_name='gtaagreement',
            name='exit_point',
            field=models.CharField(blank=True, default='Shipper Delivery Point', help_text='Gas Offtake Point, e.g. Numaligarh, Guwahati, Dimapur', max_length=100),
        ),
        migrations.AlterField(
            model_name='gtaagreement',
            name='gta_number',
            field=models.CharField(blank=True, db_index=True, max_length=50, unique=True),
        ),
        migrations.AlterField(
            model_name='gtaagreement',
            name='valid_from',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='gtaagreement',
            name='valid_to',
            field=models.DateField(blank=True, null=True),
        ),
    ]
