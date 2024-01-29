"""Build static HTML site from directory of HTML templates and plain files."""

import pathlib
import json
import shutil
import sys
import jinja2
import click


def load_config_file(input_dir):
    """Load the config.json file from the given input directory."""
    config_filename = input_dir / "config.json"

    try:
        with config_filename.open() as config_file:
            try:
                return json.load(config_file)
            except json.JSONDecodeError as error:
                print(f"mysitegenerator error: {config_filename}")
                print(str(error))
                sys.exit(1)
    except FileNotFoundError:
        print(f"mysitegenerator error: {config_filename} not found.")
        sys.exit(1)


def render_templates(input_dir, configurations):
    """Render templates from config.json using jinja."""
    template_dir = input_dir / "templates/"

    try:
        template_env = jinja2.Environment(
            loader=jinja2.FileSystemLoader(str(template_dir)),
            autoescape=jinja2.select_autoescape(['html', 'xml'])
        )
    except jinja2.TemplateError as error:
        print(f"mysitegenerator error: "
              f"unable to load template env for {template_dir}")
        print(str(error))
        sys.exit(1)

    templates = {}
    for config in configurations:
        template_name = pathlib.Path(config["template"])

        try:
            template = template_env.get_template(str(template_name))
        except jinja2.TemplateError as error:
            print(f"mysitegenerator error: "
                  f"unable to load template {template_name}")
            print(str(error))
            sys.exit(1)

        try:
            render = template.render(config["context"])
        except jinja2.TemplateError as error:
            print(f"mysitegenerator error: "
                  f"unable to render {template_name}")
            print(str(error))
            sys.exit(1)

        template_path = pathlib.Path(config["url"].lstrip("/") + "index.html")
        templates[template_path] = (render, template_name)
    return templates


def write_output(output, templates, verbose):
    """Write templated output to output directory."""
    for template_path in templates:
        output_file = output / template_path
        output_file.parent.mkdir(parents=True, exist_ok=True)
        try:
            pathlib.Path.touch(output_file)
        except FileExistsError as error:
            print(f"mysitegenerator error: {output_file}")
            print(str(error))
        try:
            with output_file.open(mode='w') as html:
                html.write(templates[template_path][0])
        except FileNotFoundError as error:
            print(f"mysitegenerator error: {templates[template_path][0]}")
            print(str(error))
        if verbose:
            print(f"Rendered {templates[template_path][1]} -> {template_path}")


@click.command()
@click.option("-o", "--output",
              help="Output directory.", type=click.Path(exists=False))
@click.option("-v", "--verbose",
              help="Print more output.", is_flag=True)
@click.argument("input_dir", nargs=1, type=click.Path(exists=True))
def main(input_dir, verbose, output):
    """Templated static website generator."""
    input_dir = pathlib.Path(input_dir)
    # print(f"DEBUG input_dir={input_dir}")
    # print(f"DEBUG verbose={verbose}")
    if output is None:
        output = input_dir / "html/"
    else:
        output = pathlib.Path(output)
    # print(f"DEBUG output={output}")
    try:
        pathlib.Path.mkdir(output)
    except FileExistsError:
        print(f"mysitegenerator error: {output} already exists.")
        sys.exit(1)

    # Step 1: Read configurtation file
    configurations = load_config_file(input_dir)

    # Step 2: Render templates
    templates = render_templates(input_dir, configurations)

    # Step 3: Write output
    write_output(output, templates, verbose)

    # check if there is a static sub-directory
    if pathlib.Path.is_dir(input_dir / "static/"):
        shutil.copytree(input_dir / "static/", output, dirs_exist_ok=True)
        if verbose:
            print(f"Copied {input_dir / 'static/'} -> {input_dir / 'html/'}")


if __name__ == "__main__":
    main()
