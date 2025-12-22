# ihimnm

You know when you need this.

Make sure to install your `node_modules` before running the CLI.

```bash
# Search for closest package.json and find deps matching the criteria
npx ihimnm

# Search nested package.json files and find deps matching the criteria
# (useful for monorepos)
npx ihimnm -r

# In case there's someone else you want to look for
npx ihimnm -u <npm-username>
```

## License

MIT
